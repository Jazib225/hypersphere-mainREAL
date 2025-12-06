// In-memory transaction store to replace database
// Stores all transactions received from merchant devices

import crypto from 'crypto';

const transactions = new Map(); // paymentIntentId -> transaction data
const merchantTransactions = new Map(); // merchantId -> Set of paymentIntentIds

/**
 * Store a transaction (updates if exists, creates if new)
 */
export function storeTransaction(transaction) {
  const {
    id,
    merchant_id,
    amount,
    chain,
    currency,
    tip_amount,
    tx_signature,
    explorer_url,
    status,
    created_at,
    updated_at,
    payment_intent_id,
    source,
  } = transaction;

  // Check if transaction already exists
  const existing = transactions.get(id);
  const now = new Date().toISOString();

  const txData = {
    id: id || crypto.randomUUID(),
    merchant_id: merchant_id || existing?.merchant_id || '',
    amount: amount !== undefined ? amount : (existing?.amount || 0),
    chain: chain || existing?.chain || 'SOL',
    currency: currency || existing?.currency || 'USDC',
    tip_amount: tip_amount !== undefined ? tip_amount : (existing?.tip_amount || 0),
    tx_signature: tx_signature || existing?.tx_signature || null,
    explorer_url: explorer_url || existing?.explorer_url || null,
    status: status || existing?.status || 'confirmed',
    // Preserve original created_at if updating, otherwise use new timestamp
    created_at: existing?.created_at || created_at || now,
    updated_at: updated_at || now,
    // Additional metadata
    payment_intent_id: payment_intent_id || existing?.payment_intent_id || null,
    source: source || existing?.source || null,
  };

  transactions.set(txData.id, txData);

  // Track by merchant
  if (txData.merchant_id) {
    if (!merchantTransactions.has(txData.merchant_id)) {
      merchantTransactions.set(txData.merchant_id, new Set());
    }
    merchantTransactions.get(txData.merchant_id).add(txData.id);
  }

  return txData;
}

/**
 * Get transaction by ID
 */
export function getTransaction(id) {
  return transactions.get(id) || null;
}

/**
 * Get all transactions for a merchant
 * Returns transactions sorted by newest first (most recent at index 0)
 */
export function getMerchantTransactions(merchantId) {
  const txIds = merchantTransactions.get(merchantId) || new Set();
  const txs = Array.from(txIds)
    .map(id => transactions.get(id))
    .filter(tx => tx !== undefined && tx !== null)
    .sort((a, b) => {
      // Sort by created_at descending (newest first)
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
  
  return txs;
}

/**
 * Update transaction status
 */
export function updateTransactionStatus(id, status, tx_signature = null) {
  const tx = transactions.get(id);
  if (!tx) return null;

  tx.status = status;
  if (tx_signature) {
    tx.tx_signature = tx_signature;
  }
  tx.updated_at = new Date().toISOString();

  transactions.set(id, tx);
  return tx;
}

/**
 * Get all transactions (for debugging)
 */
export function getAllTransactions() {
  return Array.from(transactions.values());
}

/**
 * Clear all transactions (for testing)
 */
export function clearAllTransactions() {
  transactions.clear();
  merchantTransactions.clear();
}

/**
 * Seed sample transactions for demonstration
 */
export function seedSampleTransactions(merchantId = '4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U') {
  const now = new Date();
  const chains = ['SOL', 'ETH', 'BASE'];
  const statuses = ['paid', 'confirmed', 'paid', 'paid', 'confirmed']; // Mix of statuses
  
  // Generate transactions for the last 14 days (starting from day 1, not today)
  // This ensures sample data is always in the past and new transactions appear at top
  const sampleTransactions = [];
  
  for (let day = 1; day < 14; day++) {  // Start from day 1 (yesterday) not day 0 (today)
    const date = new Date(now);
    date.setDate(now.getDate() - day);
    
    // Generate 2-5 transactions per day
    const transactionsPerDay = Math.floor(Math.random() * 4) + 2;
    
    for (let i = 0; i < transactionsPerDay; i++) {
      const hour = Math.floor(Math.random() * 24);
      const minute = Math.floor(Math.random() * 60);
      const transactionDate = new Date(date);
      transactionDate.setHours(hour, minute, 0, 0);
      
      // Vary amounts: mostly small-medium, some large
      const amountOptions = [
        Math.random() * 50 + 10,      // $10-$60
        Math.random() * 200 + 50,      // $50-$250
        Math.random() * 1000 + 200,    // $200-$1200
        Math.random() * 5000 + 1000,   // $1000-$6000
      ];
      const amount = amountOptions[Math.floor(Math.random() * amountOptions.length)];
      
      // Random chain
      const chain = chains[Math.floor(Math.random() * chains.length)];
      
      // Random status (mostly paid)
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      // Random tip (30% chance of having a tip)
      const hasTip = Math.random() < 0.3;
      const tipAmount = hasTip ? Math.random() * 20 + 2 : 0;
      
      // Generate fake transaction signature
      const txSignature = generateFakeTxSignature();
      
      const transaction = {
        id: `sample-${day}-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        merchant_id: merchantId,
        amount: Math.round(amount * 100) / 100, // Round to 2 decimals
        chain: chain,
        currency: 'USDC',
        tip_amount: Math.round(tipAmount * 100) / 100,
        tx_signature: status === 'paid' ? txSignature : null,
        status: status,
        created_at: transactionDate.toISOString(),
        updated_at: transactionDate.toISOString(),
      };
      
      sampleTransactions.push(transaction);
      storeTransaction(transaction);
    }
  }
  
  console.log(`✓ Seeded ${sampleTransactions.length} sample transactions`);
  return sampleTransactions;
}

/**
 * Generate a fake transaction signature for demo purposes
 */
function generateFakeTxSignature() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 88; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

