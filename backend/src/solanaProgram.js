import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { derivePaymentIntentPDA, getConnection } from './solanaListener.js';

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || '3fJqtvkQLR45CVT83LqRP8hefjkXxAjKZ4e1N4QdHKMR');

/**
 * Creates a PaymentIntent account on-chain
 * Note: This requires a wallet with SOL to pay for account creation
 */
export async function createPaymentIntentOnChain(
  paymentIntentId,
  amount,
  nonce,
  merchantPubkey,
  merchantKeypair = null
) {
  try {
    const conn = getConnection();
    const { pda, bump } = derivePaymentIntentPDA(paymentIntentId);

    // If no keypair provided, we can't create the account
    // In production, this would be called by the merchant's wallet
    if (!merchantKeypair) {
      console.warn('No merchant keypair provided. PaymentIntent will not be created on-chain.');
      console.warn('Merchant should call create_payment_intent instruction from their wallet.');
      return { pda: pda.toBase58(), bump, created: false };
    }

    // For now, we'll return the PDA info
    // Actual account creation should be done by the merchant's wallet
    // or through a separate service that has the merchant's keypair
    console.log(`PaymentIntent PDA: ${pda.toBase58()}, bump: ${bump}`);
    console.log('Note: Account creation requires merchant wallet signature');

    return { pda: pda.toBase58(), bump, created: false, needsWallet: true };
  } catch (error) {
    console.error('Error creating PaymentIntent on-chain:', error);
    throw error;
  }
}

/**
 * Builds a transaction instruction for creating a PaymentIntent account
 * Returns the instruction that can be added to a transaction
 */
export function buildCreatePaymentIntentInstruction(
  paymentIntentId,
  amount,
  nonce,
  merchantPubkey,
  programId = PROGRAM_ID
) {
  const { pda, bump } = derivePaymentIntentPDA(paymentIntentId);
  const merchant = new PublicKey(merchantPubkey);

  // Instruction discriminator for create_payment_intent
  // Anchor uses first 8 bytes of sha256("global:create_payment_intent")
  // For now, we'll use a placeholder - in production, use the actual discriminator
  const discriminator = Buffer.from([0x8a, 0x8b, 0x8c, 0x8d, 0x8e, 0x8f, 0x90, 0x91]);

  // Encode instruction data
  const idBytes = Buffer.from(paymentIntentId, 'utf8');
  const idLength = Buffer.allocUnsafe(4);
  idLength.writeUInt32LE(idBytes.length, 0);

  const amountBytes = Buffer.allocUnsafe(8);
  amountBytes.writeBigUInt64LE(BigInt(amount), 0);

  const nonceBytes = Buffer.from(nonce, 'hex');

  const instructionData = Buffer.concat([
    discriminator,
    idLength,
    idBytes,
    amountBytes,
    nonceBytes,
  ]);

  return {
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: merchant, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: programId,
    data: instructionData,
  };
}

/**
 * Builds a transaction instruction for pay_invoice
 */
export function buildPayInvoiceInstruction(
  paymentIntentId,
  amount,
  nonce,
  payerPubkey,
  programId = PROGRAM_ID
) {
  const { pda, bump } = derivePaymentIntentPDA(paymentIntentId);
  const payer = new PublicKey(payerPubkey);

  // Instruction discriminator for pay_invoice
  // Anchor uses first 8 bytes of sha256("global:pay_invoice")
  const discriminator = Buffer.from([0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99]);

  // Encode instruction data
  const idBytes = Buffer.from(paymentIntentId, 'utf8');
  const idLength = Buffer.allocUnsafe(4);
  idLength.writeUInt32LE(idBytes.length, 0);

  const amountBytes = Buffer.allocUnsafe(8);
  amountBytes.writeBigUInt64LE(BigInt(amount), 0);

  const nonceBytes = Buffer.from(nonce, 'hex');
  const bumpByte = Buffer.from([bump]);

  const instructionData = Buffer.concat([
    discriminator,
    idLength,
    idBytes,
    amountBytes,
    nonceBytes,
    bumpByte,
  ]);

  return {
    keys: [
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: programId,
    data: instructionData,
  };
}

export default {
  createPaymentIntentOnChain,
  buildCreatePaymentIntentInstruction,
  buildPayInvoiceInstruction,
  derivePaymentIntentPDA,
};

