/**
 * Helper script to create PaymentIntent accounts on-chain
 * This requires a merchant wallet keypair with SOL for rent
 * 
 * Usage (from backend directory):
 * node src/createOnChainAccount.js <payment_intent_id> <merchant_pubkey> [keypair_path]
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { derivePaymentIntentPDA, getConnection } from './solanaListener.js';
import { buildCreatePaymentIntentInstruction } from './solanaProgram.js';
import dotenv from 'dotenv';

dotenv.config();

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || '3fJqtvkQLR45CVT83LqRP8hefjkXxAjKZ4e1N4QdHKMR');
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

async function createOnChainAccount(paymentIntentId, merchantPubkey, keypairPath = null) {
  try {
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    
    // Load keypair if provided
    let merchantKeypair = null;
    if (keypairPath) {
      const keypairData = JSON.parse(readFileSync(keypairPath, 'utf8'));
      merchantKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
      console.log(`Loaded keypair from ${keypairPath}`);
    } else {
      console.warn('No keypair provided. Cannot create account on-chain.');
      console.warn('Provide a keypair path as the third argument.');
      return;
    }

    // Database lookup removed - amount and nonce must be passed as parameters
    console.log('Note: This script requires amount and nonce as parameters (no database).');
    
    const merchant = new PublicKey(merchantPubkey);
    const { pda, bump } = derivePaymentIntentPDA(paymentIntentId);

    console.log(`\nCreating PaymentIntent account on-chain:`);
    console.log(`  Payment Intent ID: ${paymentIntentId}`);
    console.log(`  PDA: ${pda.toBase58()}`);
    console.log(`  Bump: ${bump}`);
    console.log(`  Merchant: ${merchant.toBase58()}`);

    // In a real implementation, you would:
    // 1. Get amount and nonce from parameters (no database)
    // 2. Build the create_payment_intent instruction
    // 3. Create and send the transaction
    
    console.log('\nTo create the account, use Anchor client or build the transaction manually.');
    console.log('The instruction discriminator and account layout are defined in the Solana program.');
    
  } catch (error) {
    console.error('Error creating on-chain account:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const paymentIntentId = process.argv[2];
  const merchantPubkey = process.argv[3];
  const keypairPath = process.argv[4];

  if (!paymentIntentId || !merchantPubkey) {
    console.error('Usage: node createOnChainAccount.js <payment_intent_id> <merchant_pubkey> [keypair_path]');
    process.exit(1);
  }

  createOnChainAccount(paymentIntentId, merchantPubkey, keypairPath);
}

export { createOnChainAccount };

