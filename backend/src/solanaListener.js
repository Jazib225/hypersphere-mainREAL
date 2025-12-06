import crypto from 'crypto';
import { Connection, PublicKey } from '@solana/web3.js';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || '3fJqtvkQLR45CVT83LqRP8hefjkXxAjKZ4e1N4QdHKMR');

let connection = null;

export function getConnection() {
  if (!connection) {
    connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  }
  return connection;
}

/**
 * Derives the PDA for a PaymentIntent
 * Uses the payment_intent_id string directly as a seed (Anchor convention)
 */
export function derivePaymentIntentPDA(paymentIntentId) {
  const seeds = [
    Buffer.from('payment_intent'),
    Buffer.from(paymentIntentId, 'utf8')
  ];
  const [pda, bump] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
  return { pda, bump };
}

/**
 * Decodes PaymentIntent account data from Solana using Borsh
 * Account layout (after 8-byte discriminator):
 * - id: String (4-byte length + string bytes)
 * - merchant: Pubkey (32 bytes)
 * - amount: u64 (8 bytes)
 * - status: u8 (1 byte)
 * - nonce: [u8; 32] (32 bytes)
 * - tx_signature: String (4-byte length + string bytes)
 * - created_at: i64 (8 bytes)
 */
function decodePaymentIntentAccount(data) {
  if (!data || data.length < 8) return null;
  
  let offset = 8; // Skip Anchor discriminator
  
  // Read id (String)
  const idLength = data.readUInt32LE(offset);
  offset += 4;
  const id = data.slice(offset, offset + idLength).toString('utf8');
  offset += idLength;
  
  // Read merchant (Pubkey - 32 bytes)
  const merchant = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  // Read amount (u64 - 8 bytes)
  const amount = data.readBigUInt64LE(offset);
  offset += 8;
  
  // Read status (u8 - 1 byte)
  const status = data[offset];
  offset += 1;
  
  // Read nonce ([u8; 32] - 32 bytes)
  const nonce = data.slice(offset, offset + 32);
  offset += 32;
  
  // Read tx_signature (String)
  const sigLength = data.readUInt32LE(offset);
  offset += 4;
  const tx_signature = data.slice(offset, offset + sigLength).toString('utf8');
  offset += sigLength;
  
  // Read created_at (i64 - 8 bytes)
  const created_at = Number(data.readBigInt64LE(offset));
  
  return {
    id,
    merchant: merchant.toBase58(),
    amount: amount.toString(),
    status,
    nonce: Buffer.from(nonce),
    tx_signature,
    created_at,
  };
}

/**
 * Fetches and decodes PaymentIntent account from Solana
 */
export async function getPaymentIntentFromSolana(paymentIntentId) {
  try {
    // Validate payment intent ID - must be a valid UUID format
    // Skip seed transactions and other invalid IDs
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return null;
    }
    
    // Check if it's a seed transaction (starts with "sample-")
    if (paymentIntentId.startsWith('sample-')) {
      return null; // Seed transactions don't exist on-chain
    }
    
    // Check if it's a valid UUID format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentIntentId);
    if (!isUUID) {
      return null; // Not a valid UUID, can't derive PDA
    }
    
    const { pda } = derivePaymentIntentPDA(paymentIntentId);
    const conn = getConnection();
    const accountInfo = await conn.getAccountInfo(pda);

    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    const decoded = decodePaymentIntentAccount(accountInfo.data);
    if (!decoded) {
      return null;
    }

    return {
      pda: pda.toBase58(),
      payment_intent_id: decoded.id,
      merchant: decoded.merchant,
      amount: decoded.amount,
      status: decoded.status === 0 ? 'pending' : decoded.status === 1 ? 'paid' : 'expired',
      nonce: decoded.nonce.toString('hex'),
      tx_signature: decoded.tx_signature,
      created_at: new Date(decoded.created_at * 1000).toISOString(),
    };
  } catch (err) {
    // Only log errors that aren't expected (like seed length errors for seed data)
    if (!err.message || !err.message.includes('Max seed length exceeded')) {
      console.error('Error fetching PaymentIntent from Solana:', err);
    }
    return null;
  }
}

/**
 * Periodic listener / poller (simple placeholder)
 */
export async function subscribeToPaymentIntents(onPaymentConfirmed) {
  const conn = getConnection();
  console.log('Starting Solana payment listener (polling)...');

  const interval = setInterval(async () => {
    try {
      // No-op placeholder. Real implementation would query program accounts or use webhooks.
    } catch (err) {
      console.error('Error in Solana listener:', err);
    }
  }, 5000);

  return () => clearInterval(interval);
}

/**
 * Verifies a transaction signature and (optionally) checks for a token transfer to expectedRecipient
 *
 * Parameters:
 *  - txSignature: string
 *  - expectedRecipient: base58 pubkey string (owner of token account expected to receive tokens)
  export async function verifyTokenTransfer(txSignature, expectedMint, expectedRecipientOwner, expectedAmount) {
    try {
      const conn = getConnection();
      const tx = await conn.getTransaction(txSignature, { maxSupportedTransactionVersion: 0 });
      if (!tx || tx.meta?.err) return null;

      const pre = tx.meta.preTokenBalances || [];
      const post = tx.meta.postTokenBalances || [];

      // expectedAmount is a number/string representing smallest units
      const expectedBig = BigInt(expectedAmount || 0);

      // Find any post balance entry matching the mint and recipient owner
      for (const p of post) {
        if (!p.mint) continue;
        if (p.mint !== expectedMint) continue;

        // owner may be available on the post entry
        const owner = p.owner || null;
        if (!owner) continue;

        // Only consider entries where owner matches expectedRecipientOwner
        if (expectedRecipientOwner && owner !== expectedRecipientOwner) continue;

        // Find corresponding pre balance by accountIndex where possible
        const preEntry = pre.find(x => x.accountIndex === p.accountIndex) || {};

        const before = BigInt(preEntry?.uiTokenAmount?.amount || '0');
        const after = BigInt(p?.uiTokenAmount?.amount || '0');
        const delta = after - before;

        if (delta >= expectedBig && delta > 0n) {
          return {
            confirmed: tx.blockTime !== null,
            blockTime: tx.blockTime,
            slot: tx.slot,
            status: 'confirmed',
            token: { mint: expectedMint, recipient: owner, amount: delta.toString() },
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error verifying token transfer:', error);
      return null;
    }
 *  - expectedAmount: integer in smallest token units (e.g., for USDC with 6 decimals)
 *  - opts: { tokenMint: string (base58) }
 */
export async function verifyTransactionSignature(txSignature, expectedRecipient = null, expectedAmount = 0, opts = {}) {
  try {
    const conn = getConnection();
    const tx = await conn.getTransaction(txSignature, { commitment: 'confirmed' });
    if (!tx) return null;

    // If tokenMint provided, inspect token balance diffs
    if (opts.tokenMint) {
      const mint = opts.tokenMint.toString ? opts.tokenMint.toString() : opts.tokenMint;
      const pre = tx.meta && tx.meta.preTokenBalances ? tx.meta.preTokenBalances : [];
      const post = tx.meta && tx.meta.postTokenBalances ? tx.meta.postTokenBalances : [];

      // Find post balances that match mint and owner
      const matches = (post || []).filter(p => {
        try {
          return p.mint === mint && p.owner === expectedRecipient;
        } catch (e) {
          return false;
        }
      });

      let totalReceived = 0n;
      for (const m of matches) {
        const amt = BigInt(m.uiTokenAmount.amount || '0');
        const preMatch = (pre || []).find(p => p.accountIndex === m.accountIndex && p.mint === m.mint);
        const preAmt = preMatch ? BigInt(preMatch.uiTokenAmount.amount || '0') : 0n;
        if (amt > preAmt) totalReceived += (amt - preAmt);
      }

      const expected = BigInt(expectedAmount || 0);
      const success = (totalReceived >= expected) && tx.meta && tx.meta.err === null;

      return {
        confirmed: tx.blockTime !== null,
        blockTime: tx.blockTime,
        slot: tx.slot,
        status: success ? 'confirmed' : (tx.meta?.err ? 'failed' : 'pending'),
        tokenReceived: totalReceived.toString(),
      };
    }

    // Fallback: return basic tx status
    return {
      confirmed: tx.blockTime !== null,
      blockTime: tx.blockTime,
      slot: tx.slot,
      status: tx.meta?.err ? 'failed' : 'confirmed',
    };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return null;
  }
}

/**
 * Verify a token transfer by inspecting pre/post token balances for a given transaction.
 * Returns an object with details if a matching transfer is found, otherwise null.
 */
export async function verifyTokenTransfer(txSignature, expectedMint, expectedRecipientOwner, expectedAmount) {
  try {
    const conn = getConnection();
    const tx = await conn.getTransaction(txSignature, { maxSupportedTransactionVersion: 0 });
    if (!tx || tx.meta?.err) return null;

    const pre = tx.meta.preTokenBalances || [];
    const post = tx.meta.postTokenBalances || [];

    const expectedBig = BigInt(expectedAmount || 0);

    for (const p of post) {
      if (!p.mint) continue;
      if (p.mint !== expectedMint) continue;

      const owner = p.owner || null;
      if (!owner) continue;
      if (expectedRecipientOwner && owner !== expectedRecipientOwner) continue;

      const preEntry = pre.find(x => x.accountIndex === p.accountIndex) || {};

      const before = BigInt(preEntry?.uiTokenAmount?.amount || '0');
      const after = BigInt(p?.uiTokenAmount?.amount || '0');
      const delta = after - before;

      if (delta >= expectedBig && delta > 0n) {
        return {
          confirmed: tx.blockTime !== null,
          blockTime: tx.blockTime,
          slot: tx.slot,
          status: 'confirmed',
          token: { mint: expectedMint, recipient: owner, amount: delta.toString() },
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error verifying token transfer:', error);
    return null;
  }
}

/**
 * Watch a PaymentIntent PDA for changes (subscribe to account change)
 */
export async function watchPaymentIntent(paymentIntentId, callback) {
  const { pda } = derivePaymentIntentPDA(paymentIntentId);
  const conn = getConnection();

  try {
    const subscriptionId = conn.onAccountChange(
      pda,
      (accountInfo) => {
        try {
          if (!accountInfo || !accountInfo.data) {
            console.warn(`Account ${pda.toBase58()} has no data`);
            return;
          }

          const decoded = decodePaymentIntentAccount(accountInfo.data);
          if (!decoded) {
            console.warn(`Failed to decode account data for ${paymentIntentId}`);
            return;
          }

          const status = decoded.status === 0 ? 'pending' : decoded.status === 1 ? 'paid' : 'expired';
          
          callback({
            paymentIntentId,
            pda: pda.toBase58(),
            amount: decoded.amount,
            status,
            tx_signature: decoded.tx_signature || '',
            merchant: decoded.merchant,
            nonce: decoded.nonce.toString('hex'),
          });
        } catch (err) {
          console.error('Error processing account data:', err);
        }
      },
      'confirmed'
    );

    console.log(`Watching PaymentIntent PDA: ${pda.toBase58()} for payment intent: ${paymentIntentId}`);

    return () => {
      try {
        conn.removeAccountChangeListener(subscriptionId);
        console.log(`Unsubscribed watcher for ${paymentIntentId}`);
      } catch (err) {
        console.error('Error unsubscribing watcher:', err);
      }
    };
  } catch (error) {
    console.error('Error watching PaymentIntent:', error);
    return null;
  }
}

export default {
  getConnection,
  derivePaymentIntentPDA,
  getPaymentIntentFromSolana,
  subscribeToPaymentIntents,
  verifyTransactionSignature,
  verifyTokenTransfer,
  watchPaymentIntent,
};
