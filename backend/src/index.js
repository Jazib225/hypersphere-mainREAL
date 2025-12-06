import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4, validate as validateUUID } from 'uuid';
import crypto from 'crypto';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
// Database imports removed
import {
  getConnection,
  derivePaymentIntentPDA,
  watchPaymentIntent,
  verifyTransactionSignature,
  verifyTokenTransfer,
  getPaymentIntentFromSolana,
} from './solanaListener.js';
import {
  storeTransaction,
  getTransaction,
  getMerchantTransactions,
  updateTransactionStatus,
  getAllTransactions,
  seedSampleTransactions,
} from './transactionStore.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// Create HTTP server and attach Socket.IO
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join merchant-specific room for targeted broadcasts
  socket.on('join:merchant', (merchantId) => {
    socket.join(`merchant:${merchantId}`);
    console.log(`📊 Client ${socket.id} joined merchant room: ${merchantId}`);
  });

  // Leave merchant room
  socket.on('leave:merchant', (merchantId) => {
    socket.leave(`merchant:${merchantId}`);
    console.log(`📊 Client ${socket.id} left merchant room: ${merchantId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

/**
 * Broadcast new transaction to all connected clients for a merchant
 */
function broadcastNewTransaction(merchantId, transaction) {
  console.log(`📡 Broadcasting transaction:new to merchant:${merchantId}`);
  io.to(`merchant:${merchantId}`).emit('transaction:new', transaction);
  // Also broadcast to all clients (for debugging/global dashboards)
  io.emit('transaction:any', transaction);
}

// Middleware
app.use(cors());
app.use(express.json());

// Map to track active watchers
const activeWatchers = new Map();

/**
 * Automatic transaction polling
 * Periodically checks for new transactions from payment intents
 */
async function startTransactionPolling() {
  console.log('Starting automatic transaction polling...');
  
  setInterval(async () => {
    try {
      // Get all stored transactions that are not yet paid
      const allTransactions = getAllTransactions();
      // Filter out seed transactions (they have IDs starting with "sample-")
      // and only check actual payment intents (UUIDs)
      const pendingTransactions = allTransactions.filter(tx => {
        // Skip seed transactions - they're not real on-chain transactions
        if (tx.id && tx.id.startsWith('sample-')) {
          return false;
        }
        // Only check transactions that are not yet paid
        return tx.status !== 'paid' && tx.status !== 'failed';
      });
      
      // Only poll if there are real (non-seed) pending transactions
      if (pendingTransactions.length === 0) {
        return; // Skip polling if no real transactions to check
      }
      
      for (const tx of pendingTransactions) {
        try {
          // Only check on-chain for valid UUIDs (not seed data)
          // UUIDs are 36 characters with format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tx.id);
          
          if (!isUUID) {
            continue; // Skip non-UUID transactions (seed data, etc.)
          }
          
          // Check on-chain status
          const onChainData = await getPaymentIntentFromSolana(tx.id);
          if (onChainData && onChainData.status === 'paid' && onChainData.tx_signature) {
            // Update transaction if it's now paid on-chain
            if (tx.status !== 'paid') {
              updateTransactionStatus(tx.id, 'paid', onChainData.tx_signature);
              console.log(`✓ Transaction ${tx.id} confirmed as paid via polling`);
            }
          }
        } catch (err) {
          // Silently skip errors - transaction might not exist on-chain yet
          // Only log if it's not a seed length error (which is expected for seed data)
          if (!err.message || !err.message.includes('Max seed length exceeded')) {
            // Only log unexpected errors
          }
        }
      }
    } catch (error) {
      console.error('Error in transaction polling:', error);
    }
  }, 10000); // Poll every 10 seconds
}

/**
 * Initialize the application
 */
async function initialize() {
  try {
    // Core payment system initialized

    // Verify Solana connection
    const connection = getConnection();
    const version = await connection.getVersion();
    console.log('✓ Connected to Solana:', version['solana-core']);
    
    // Seed sample transactions for demonstration
    // Only seed if no transactions exist yet
    // Set SEED_SAMPLE_DATA=false in environment to disable seeding
    if (process.env.SEED_SAMPLE_DATA !== 'false') {
      const allTxs = getAllTransactions();
      if (allTxs.length === 0) {
        const merchantId = process.env.MERCHANT_ID || '4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U';
        console.log('Seeding sample transactions for demonstration...');
        seedSampleTransactions(merchantId);
      } else {
        console.log(`Found ${allTxs.length} existing transactions, skipping seed data`);
      }
    } else {
      console.log('Sample data seeding disabled (SEED_SAMPLE_DATA=false)');
    }
    
    // Start automatic transaction polling
    startTransactionPolling();
  } catch (error) {
    console.error('Initialization error:', error);
    process.exit(1);
  }
}

/**
 * POST /payment_intents
 * Create a new payment intent
 * 
 * Body: { amount, merchant_id }
 * Returns: { id, amount, merchant_id, nonce, payment_url }
 */
app.post('/payment_intents', async (req, res) => {
  try {
    const { amount, merchant_id, currency, tip_amount, chain } = req.body;

    // Validate input
    if (amount === undefined || merchant_id === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: amount, merchant_id',
      });
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Amount must be a positive number',
      });
    }

    // Basic merchant id format check
    if (typeof merchant_id !== 'string' || merchant_id.length === 0) {
      return res.status(400).json({ error: 'merchant_id must be a non-empty string' });
    }

    // Generate unique ID
    const id = uuidv4();

    // Generate random nonce (32 bytes)
    const nonce = crypto.randomBytes(32).toString('hex');

    // Generate payment URL
    const payment_url = `${BASE_URL}/pay/${id}`;

    // Prepare token metadata (for USDC payments)
    let token_mint = null;
    let token_decimals = 6;
    let recipient_address = null;

    if (currency && String(currency).toUpperCase() === 'USDC') {
      // Use configured USDC mint unless provided by merchant/client later
      token_mint = process.env.USDC_MINT || null;
      token_decimals = process.env.USDC_DECIMALS ? parseInt(process.env.USDC_DECIMALS, 10) : 6;

      // Merchant wallet address lookup removed - no database
    }

    // Normalize chain value - ensure consistency (use SOL, not Solana)
    let normalizedChain = chain || 'SOL';
    const chainUpper = normalizedChain.toUpperCase();
    // Normalize "Solana" to "SOL" for consistency
    if (chainUpper === 'SOLANA') {
      normalizedChain = 'SOL';
    } else if (chainUpper === 'SOL') {
      normalizedChain = 'SOL';
    }

    // Create payment intent object
    const paymentIntent = {
      id,
      amount,
      merchant_id,
      nonce,
      payment_url,
      currency: currency ? String(currency).toUpperCase() : 'SOL',
      token_mint,
      recipient_address,
      token_decimals,
      tip_amount: tip_amount || 0,
      chain: normalizedChain,
    };

    // Store payment intent in memory (this is just the intent, not the final transaction)
    // The actual transaction will be created when notification is received with a NEW ID
    const saved = storeTransaction({
      ...paymentIntent,
      status: 'pending', // Payment intent is pending until notification creates actual transaction
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    console.log(`✓ Payment intent created: ${saved.id} for merchant ${saved.merchant_id}`);
    console.log(`  Amount: $${saved.amount} ${saved.currency || 'USDC'}`);
    console.log(`  Chain: ${saved.chain || 'SOL'}`);
    console.log(`  Tip: $${saved.tip_amount || 0}`);
    console.log(`  Note: Actual transaction will be created when notification is received`);

    // Derive PDA for on-chain account
    let pdaAddress = null;
    let bumpValue = null;
    try {
      const { derivePaymentIntentPDA } = await import('./solanaListener.js');
      const { pda, bump } = derivePaymentIntentPDA(id);
      pdaAddress = pda.toBase58();
      bumpValue = bump;
      console.log(`✓ Derived PDA for ${id}: ${pdaAddress}, bump: ${bump}`);
    } catch (error) {
      console.error('✗ Error deriving PDA:', error.message);
      console.error('  Stack:', error.stack);
      // Continue without PDA - account can be created later
    }

    // Start watching for payment confirmation on Solana (non-blocking)
    setupPaymentWatcher(id, merchant_id).catch(error => {
      console.error('Error setting up payment watcher:', error);
      // Continue anyway - watcher is not critical for payment intent creation
    });

    // Return saved row (includes timestamps) and PDA info for on-chain account creation
    res.status(201).json(sanitizeObject({
      ...saved,
      pda: pdaAddress,
      bump: bumpValue,
      // Note: The PaymentIntent account should be created on-chain by calling
      // the create_payment_intent instruction with the merchant's wallet
    }));
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

/**
 * GET /payment_intents/:id/status
 * Get payment intent status
 * 
 * Returns: { id, status, tx_signature, amount, merchant_id, created_at, updated_at }
 */
app.get('/payment_intents/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    // Get from transaction store
    let paymentIntent = getTransaction(id);

    // If not in store, try to get from on-chain (only for valid UUIDs)
    if (!paymentIntent) {
      // Only check on-chain for valid UUIDs, not seed transactions
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID && !id.startsWith('sample-')) {
        try {
          const onChainData = await getPaymentIntentFromSolana(id);
          if (onChainData) {
            // Store the on-chain data
            paymentIntent = storeTransaction({
              id: onChainData.payment_intent_id || id,
              merchant_id: onChainData.merchant || '',
              amount: parseFloat(onChainData.amount) || 0,
              chain: 'SOL',
              currency: 'USDC',
              tip_amount: 0,
              tx_signature: onChainData.tx_signature || null,
              status: onChainData.status === 'paid' ? 'paid' : 'confirmed',
              created_at: onChainData.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        } catch (err) {
          // Silently skip - transaction might not exist on-chain
        }
      }
    }

    if (!paymentIntent) {
      return res.status(404).json({
        error: 'Payment intent not found',
      });
    }

    // Also check on-chain status if available (only for valid UUIDs)
    let onChainData = null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUUID && !id.startsWith('sample-')) {
      try {
        onChainData = await getPaymentIntentFromSolana(id);
      } catch (err) {
        // On-chain account may not exist yet, that's okay
        // Silently skip - don't log errors for expected cases
      }
    }

    // Prefer on-chain status if available, otherwise use stored status
    const status = onChainData?.status || paymentIntent.status || 'confirmed';
    const tx_signature = onChainData?.tx_signature || paymentIntent.tx_signature || null;

    // Update stored transaction if on-chain data is newer
    if (onChainData && onChainData.status === 'paid' && paymentIntent.status !== 'paid') {
      updateTransactionStatus(id, 'paid', onChainData.tx_signature);
      paymentIntent = getTransaction(id);
    }

    res.json(sanitizeObject({
      id: paymentIntent.id,
      status,
      tx_signature,
      amount: paymentIntent.amount,
      merchant_id: paymentIntent.merchant_id,
      tip_amount: paymentIntent.tip_amount || 0,
      chain: paymentIntent.chain || 'SOL',
      on_chain: onChainData !== null,
      pda: onChainData?.pda || null,
      currency: paymentIntent.currency || 'USDC',
      created_at: paymentIntent.created_at,
      updated_at: paymentIntent.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching payment intent status:', error);
    res.status(500).json({ error: 'Failed to fetch payment intent' });
  }
});


/**
 * POST /payment_intents/:id/confirm
 * Accepts { tx_signature }
 * Verifies transaction on Solana and updates PaymentIntent status
 */
app.post('/payment_intents/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { tx_signature } = req.body;

    if (!tx_signature || typeof tx_signature !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid tx_signature' });
    }

    // Check transaction store first, then on-chain (only for valid UUIDs)
    let pi = getTransaction(id);
    if (!pi) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID && !id.startsWith('sample-')) {
        const onChainData = await getPaymentIntentFromSolana(id).catch(() => null);
        if (onChainData) {
          pi = storeTransaction({
            id: onChainData.payment_intent_id || id,
            merchant_id: onChainData.merchant || '',
            amount: parseFloat(onChainData.amount) || 0,
            chain: 'SOL',
            currency: 'USDC',
            tip_amount: 0,
            tx_signature: onChainData.tx_signature || null,
            status: onChainData.status === 'paid' ? 'paid' : 'confirmed',
            created_at: onChainData.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
    if (!pi) return res.status(404).json({ error: 'Payment intent not found' });

    // Verify transaction on Solana
    let txInfo = null;
    const currency = pi.currency || 'USDC';
    if (String(currency).toUpperCase() === 'USDC' && pi.token_mint && pi.recipient_address) {
      // For token payments, expect amount to be in smallest units already
      txInfo = await verifyTokenTransfer(tx_signature, pi.token_mint, pi.recipient_address, pi.amount);
    } else {
      txInfo = await verifyTransactionSignature(tx_signature);
    }

    if (!txInfo || txInfo.status === 'failed' || !txInfo.confirmed) {
      return res.status(400).json({ error: 'Transaction not confirmed on Solana yet' });
    }

    // Update transaction status in store with transaction signature
    const updated = updateTransactionStatus(id, 'paid', tx_signature);
    
    if (updated) {
      console.log(`✓ Payment confirmed: ${id}`);
      console.log(`  - Amount: $${updated.amount} ${updated.currency || 'USDC'}`);
      console.log(`  - Chain: ${updated.chain || 'SOL'}`);
      console.log(`  - Tip: $${updated.tip_amount || 0}`);
      console.log(`  - Signature: ${tx_signature ? tx_signature.substring(0, 20) + '...' : 'Pending'}`);
      console.log(`  - Time: ${updated.updated_at}`);
    }
    
    res.json({ success: true, payment_intent: updated || { id, status: 'paid', tx_signature } });
  } catch (error) {
    console.error('Error confirming payment intent:', error);
    res.status(500).json({ error: 'Failed to confirm payment intent' });
  }
});

/**
 * GET /merchants/:id/payments
 * Get all payments for a merchant (dashboard)
 * 
 * Returns: [ { id, amount, status, created_at, tx_signature }, ... ]
 */
app.get('/merchants/:id/payments', async (req, res) => {
  try {
    const { id: merchant_id } = req.params;

    // Get all payments for merchant from transaction store
    // Filter out 'pending' payment intents - only show 'paid' or 'confirmed' transactions
    const allPayments = getMerchantTransactions(merchant_id);
    const payments = allPayments.filter(p => p.status === 'paid' || p.status === 'confirmed');

    console.log(`\n📊 Fetching payments for merchant: ${merchant_id}`);
    console.log(`   Found ${payments.length} transactions`);
    if (payments.length > 0) {
      console.log(`   Latest: ${payments[0].id} - $${payments[0].amount} ${payments[0].chain} - ${payments[0].status}`);
    }

    res.json(sanitizeObject({
      merchant_id,
      total_count: payments.length,
      payments: payments.map(p => sanitizeObject({
        id: p.id,
        amount: p.amount,
        status: p.status,
        tip_amount: p.tip_amount || 0,
        chain: p.chain || 'SOL',
        currency: p.currency || 'USDC',
        created_at: p.created_at,
        updated_at: p.updated_at,
        tx_signature: p.tx_signature,
      })),
    }));
  } catch (error) {
    console.error('Error fetching merchant payments:', error);
    res.status(500).json({ error: 'Failed to fetch merchant payments' });
  }
});

/**
 * GET /pay/:id
 * Payment page redirect (can be extended with UI)
 * This endpoint is called when user scans/opens payment URL
 */
app.get('/pay/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if transaction already exists in store
    let paymentIntent = getTransaction(id);
    
    // If not in store, try to get from on-chain (only for valid UUIDs)
    if (!paymentIntent) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID && !id.startsWith('sample-')) {
        try {
          const onChainData = await getPaymentIntentFromSolana(id);
          if (onChainData) {
            paymentIntent = storeTransaction({
              id: onChainData.payment_intent_id || id,
              merchant_id: onChainData.merchant || '',
              amount: parseFloat(onChainData.amount) || 0,
              chain: 'SOL',
              currency: 'USDC',
              tip_amount: 0,
              tx_signature: onChainData.tx_signature || null,
              status: onChainData.status === 'paid' ? 'paid' : 'confirmed',
              created_at: onChainData.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        } catch (err) {
          // Silently skip - transaction might not exist on-chain
        }
      }
    }

    // If still not found, return error
    if (!paymentIntent) {
      return res.status(404).json({ error: 'Payment intent not found' });
    }

    // Start watching for payment confirmation
    setupPaymentWatcher(id, paymentIntent.merchant_id).catch(error => {
      console.error('Error setting up payment watcher:', error);
    });
    
      // Also check immediately if transaction is already paid (only for valid UUIDs)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID && !id.startsWith('sample-')) {
        try {
          const onChainCheck = await getPaymentIntentFromSolana(id);
          if (onChainCheck && onChainCheck.status === 'paid' && onChainCheck.tx_signature) {
            updateTransactionStatus(id, 'paid', onChainCheck.tx_signature);
            console.log(`✓ Transaction ${id} already paid on-chain`);
          }
        } catch (err) {
          // Transaction might not exist on-chain yet, that's okay
        }
      }

    // Return payment intent details for frontend integration
    res.json(sanitizeObject({
      paymentIntentId: id,
      amount: paymentIntent.amount || 0,
      nonce: paymentIntent.nonce || '',
      merchant_id: paymentIntent.merchant_id || '',
      currency: paymentIntent.currency || 'USDC',
      token_mint: null,
      token_decimals: 6,
      recipient_address: null,
      programId: process.env.PROGRAM_ID || '3fJqtvkQLR45CVT83LqRP8hefjkXxAjKZ4e1N4QdHKMR',
    }));
  } catch (error) {
    console.error('Error fetching payment page:', error);
    res.status(500).json({ error: 'Failed to load payment page' });
  }
});

/**
 * POST /transactions/notify
 * Endpoint to receive transaction notifications from wallets/webhooks
 * This allows automatic registration of transactions when they occur
 * Records: Time, Amount (USDC), Chain, Tip, Transaction Signature
 */
app.post('/transactions/notify', async (req, res) => {
  try {
    const {
      payment_intent_id,
      merchant_id,
      amount,
      chain,
      currency,
      tip_amount,
      tx_signature,
      explorer_url,
      status,
      source,
    } = req.body;

    if (!merchant_id || amount === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: merchant_id, amount',
      });
    }
    
    // Generate explorer URL if not provided
    const finalExplorerUrl = explorer_url || generateExplorerUrl(chain || 'SOL', tx_signature);

    // CRITICAL FIX: Generate a NEW transaction ID for each payment
    // Don't reuse payment_intent_id - each payment should be a NEW transaction
    // This ensures each NFC tap or Test URL click creates a NEW entry in the table
    const transactionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const timestamp = Date.now();
    
    // Additional deduplication: Check if we recently created a transaction with same amount/chain/tip
    // This is a backend-level safety check
    const recentTxs = getMerchantTransactions(merchant_id)
      .filter(tx => {
        const txTime = new Date(tx.created_at).getTime();
        const timeDiff = timestamp - txTime;
        return timeDiff < 2000 && // Within 2 seconds
               tx.amount === parseFloat(amount) &&
               tx.chain === (chain || 'SOL') &&
               tx.tip_amount === (tip_amount || 0);
      });
    
    if (recentTxs.length > 0) {
      console.log(`\n⚠️ DUPLICATE TRANSACTION DETECTED (backend)`);
      console.log(`  Found ${recentTxs.length} recent transaction(s) with same amount/chain/tip`);
      console.log(`  Most recent: ${recentTxs[0].id} at ${recentTxs[0].created_at}`);
      console.log(`  This transaction will still be created but logged for review\n`);
    }
    
    // Create a NEW transaction object (never update existing)
    const transaction = storeTransaction({
      id: transactionId, // NEW ID for each payment
      merchant_id,
      amount: parseFloat(amount),
      chain: chain || 'SOL',
      currency: currency || 'USDC',
      tip_amount: tip_amount || 0,
      tx_signature: tx_signature || null,
      explorer_url: finalExplorerUrl,
      status: status || 'paid', // Default to paid when notification is sent
      created_at: now, // Always use current timestamp for new transaction
      updated_at: now,
      // Store metadata for reference
      payment_intent_id: payment_intent_id || `tap-${timestamp}`,
      source: source || 'unknown',
    });
    
    // Verify transaction was stored correctly
    const verifyTx = getTransaction(transactionId);
    if (!verifyTx) {
      console.error(`❌ ERROR: Transaction ${transactionId} was not stored!`);
      return res.status(500).json({ error: 'Failed to store transaction' });
    }

    console.log(`\n✓✓✓ NEW TRANSACTION CREATED ✓✓✓`);
    console.log(`  Transaction ID: ${transactionId}`);
    console.log(`  Payment Intent ID: ${payment_intent_id}`);
    console.log(`  Merchant: ${merchant_id}`);
    console.log(`  Base Amount: $${amount} ${currency || 'USDC'}`);
    console.log(`  Tip: $${tip_amount || 0}`);
    console.log(`  Total: $${parseFloat(amount) + (tip_amount || 0)}`);
    console.log(`  Chain: ${chain || 'SOL'}`);
    console.log(`  Signature: ${tx_signature ? tx_signature.substring(0, 20) + '...' : 'N/A'}`);
    console.log(`  Status: ${transaction.status}`);
    console.log(`  Time: ${transaction.created_at}`);
    
    // Get total count for this merchant to verify it was added
    const allMerchantTxs = getMerchantTransactions(merchant_id);
    console.log(`  Total transactions for merchant: ${allMerchantTxs.length}`);
    
    // Verify this transaction is in the list
    const txInList = allMerchantTxs.find(tx => tx.id === transactionId);
    if (txInList) {
      console.log(`  ✓ Transaction verified in merchant list (position: ${allMerchantTxs.indexOf(txInList) + 1})`);
    } else {
      console.error(`  ❌ ERROR: Transaction NOT found in merchant list!`);
    }
    
    console.log(`✓✓✓ Broadcasting to frontend via WebSocket NOW ✓✓✓\n`);

    // Broadcast to all connected clients for this merchant IMMEDIATELY
    const broadcastPayload = {
      id: transaction.id,
      merchant_id: transaction.merchant_id,
      amount: transaction.amount,
      chain: transaction.chain,
      currency: transaction.currency,
      tip_amount: transaction.tip_amount,
      tx_signature: transaction.tx_signature,
      explorer_url: transaction.explorer_url,
      status: transaction.status,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    };
    broadcastNewTransaction(merchant_id, broadcastPayload);
    
    console.log(`  Explorer: ${transaction.explorer_url}`);

    // Start watching for payment confirmation if not already paid
    if (status !== 'paid' && tx_signature) {
      setupPaymentWatcher(payment_intent_id, merchant_id).catch(error => {
        console.error('Error setting up payment watcher:', error);
      });
    }

    res.status(201).json({
      success: true,
      transaction: {
        id: transaction.id,
        transaction_id: transactionId, // Return the new transaction ID
        merchant_id: transaction.merchant_id,
        amount: transaction.amount,
        chain: transaction.chain,
        currency: transaction.currency,
        tip_amount: transaction.tip_amount,
        tx_signature: transaction.tx_signature,
        status: transaction.status,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      },
    });
  } catch (error) {
    console.error('Error registering transaction:', error);
    res.status(500).json({ error: 'Failed to register transaction' });
  }
});

/**
 * DELETE /merchants/:id/payments
 * Delete all payments for a merchant (for testing/cleanup)
 */
app.delete('/merchants/:id/payments', async (req, res) => {
  try {
    const { id: merchant_id } = req.params;
    
    // Database operation removed
    res.json({ 
      success: true, 
      deleted_count: 0,
      merchant_id 
    });
  } catch (error) {
    console.error('Error deleting payments:', error);
    res.status(500).json({ error: 'Failed to delete payments' });
  }
});

/**
 * POST /merchants/:id/payments/mark-paid
 * Mark all pending payments as paid (for testing purposes)
 */
app.post('/merchants/:id/payments/mark-paid', async (req, res) => {
  try {
    const { id: merchant_id } = req.params;
    
    // Database operation removed
    res.json({ 
      success: true, 
      updated_count: 0,
      message: 'No database - payments tracked on-chain only'
    });
  } catch (error) {
    console.error('Error marking payments as paid:', error);
    res.status(500).json({ error: 'Failed to mark payments as paid' });
  }
});

/**
 * GET /merchants/:id/settings
 * Get merchant settings/profile
 */
app.get('/merchants/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    // Database lookup removed
    res.status(404).json({ error: 'Merchant not found - no database' });
  } catch (error) {
    console.error('Error fetching merchant settings:', error);
    res.status(500).json({ error: 'Failed to fetch merchant settings' });
  }
});

/**
 * PUT /merchants/:id/settings
 * Update merchant settings/profile
 */
app.put('/merchants/:id/settings', async (req, res) => {
  try {
    const { id } = req.params;
    // Database operations removed
    res.status(500).json({ error: 'Merchant settings not available - no database' });
  } catch (error) {
    console.error('Error updating merchant settings:', error);
    res.status(500).json({ error: `Failed to update merchant settings: ${error.message}` });
  }
});

/**
 * GET /merchants/:id/wallet/:chain
 * Get wallet address for a specific chain
 */
app.get('/merchants/:id/wallet/:chain', async (req, res) => {
  try {
    const { id, chain } = req.params;
    // Database lookup removed
    res.status(404).json({ error: 'Merchant not found - no database' });
  } catch (error) {
    console.error('Error fetching wallet address:', error);
    res.status(500).json({ error: 'Failed to fetch wallet address' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', websocket: 'enabled' });
});

/**
 * POST /api/test-transaction
 * Create a test transaction (for debugging real-time updates)
 */
app.post('/api/test-transaction', (req, res) => {
  try {
    const merchantId = req.body.merchant_id || '4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U';
    const amount = req.body.amount || 0.06;
    const chain = req.body.chain || 'SOL';
    const tipAmount = req.body.tip_amount || 0.01;
    
    const transactionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const txSignature = generateTestTxSignature();
    
    const transaction = storeTransaction({
      id: transactionId,
      merchant_id: merchantId,
      amount: parseFloat(amount),
      chain: chain,
      currency: 'USDC',
      tip_amount: parseFloat(tipAmount),
      tx_signature: txSignature,
      status: 'paid',
      created_at: now,
      updated_at: now,
    });
    
    console.log(`\\n🧪 TEST TRANSACTION CREATED`);
    console.log(`  ID: ${transactionId}`);
    console.log(`  Amount: $${amount} ${chain}`);
    console.log(`  Tip: $${tipAmount}`);
    console.log(`  Broadcasting to WebSocket...`);
    
    // Broadcast to WebSocket clients
    broadcastNewTransaction(merchantId, {
      id: transaction.id,
      merchant_id: transaction.merchant_id,
      amount: transaction.amount,
      chain: transaction.chain,
      currency: transaction.currency,
      tip_amount: transaction.tip_amount,
      tx_signature: transaction.tx_signature,
      status: transaction.status,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
    });
    
    res.status(201).json({
      success: true,
      message: 'Test transaction created and broadcast',
      transaction: transaction
    });
  } catch (error) {
    console.error('Error creating test transaction:', error);
    res.status(500).json({ error: 'Failed to create test transaction' });
  }
});

function generateTestTxSignature() {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  return Array.from({length: 88}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

/**
 * Generate blockchain explorer URL based on chain and transaction signature
 */
function generateExplorerUrl(chain, txSignature) {
  if (!txSignature) return null;
  
  const chainUpper = (chain || 'SOL').toUpperCase();
  
  switch (chainUpper) {
    case 'SOL':
    case 'SOLANA':
      return `https://solscan.io/tx/${txSignature}`;
    case 'ETH':
    case 'ETHEREUM':
      return `https://etherscan.io/tx/${txSignature}`;
    case 'BASE':
      return `https://basescan.org/tx/${txSignature}`;
    default:
      return `https://solscan.io/tx/${txSignature}`;
  }
}

/**
 * GET /debug/transactions
 * Debug endpoint to see all stored transactions
 */
app.get('/debug/transactions', (req, res) => {
  try {
    const allTxs = getAllTransactions();
    const merchantId = req.query.merchant_id || '4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U';
    const merchantTxs = getMerchantTransactions(merchantId);
    
    res.json({
      total_transactions: allTxs.length,
      merchant_transactions: merchantTxs.length,
      merchant_id: merchantId,
      all_transactions: allTxs,
      merchant_transactions_list: merchantTxs,
    });
  } catch (error) {
    console.error('Error fetching debug transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});


/**
 * Setup payment watcher for a specific payment intent
 */
async function setupPaymentWatcher(paymentIntentId, merchantId) {
  try {
    // Check if already watching
    if (activeWatchers.has(paymentIntentId)) {
      return;
    }

    // Start watching the Solana account
    const unsubscribe = await watchPaymentIntent(paymentIntentId, async (update) => {
      console.log(`Payment update for ${paymentIntentId}:`, update);

      // Database update removed - status tracked on-chain only
      if (update.status === 'paid' || update.status === 1) {
        updateTransactionStatus(
          paymentIntentId,
          'paid',
          update.tx_signature || ''
        );
        console.log(`✓ Payment confirmed on-chain: ${paymentIntentId}`);

        // Stop watching after payment confirmed
        if (unsubscribe) {
          unsubscribe();
          activeWatchers.delete(paymentIntentId);
        }
      }
    });

    if (unsubscribe) {
      activeWatchers.set(paymentIntentId, unsubscribe);

      // Auto-cleanup after 24 hours (even if not paid)
      setTimeout(() => {
        if (activeWatchers.has(paymentIntentId)) {
          unsubscribe();
          activeWatchers.delete(paymentIntentId);
          console.log(`✓ Stopped watching payment: ${paymentIntentId}`);
        }
      }, 24 * 60 * 60 * 1000);
    }
  } catch (error) {
    console.error('Error setting up payment watcher:', error);
  }
}

// Basic sanitization helpers to avoid reflected XSS in returned JSON
function sanitizeString(s) {
  if (s === null || s === undefined) return s;
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    out[k] = typeof v === 'string' ? sanitizeString(v) : v;
  }
  return out;
}

/**
 * Cleanup function
 */
function cleanup() {
  console.log('Cleaning up active watchers...');
  activeWatchers.forEach((unsubscribe, paymentIntentId) => {
    try {
      if (unsubscribe) {
        unsubscribe();
      }
      console.log(`✓ Stopped watching: ${paymentIntentId}`);
    } catch (error) {
      console.error(`Error stopping watcher for ${paymentIntentId}:`, error);
    }
  });
  activeWatchers.clear();
}

// Start server
async function start() {
  try {
    await initialize();

    const server = httpServer.listen(PORT, () => {
      console.log(`\n🚀 Backend server running on http://localhost:${PORT}`);
      console.log('🔌 WebSocket enabled for real-time updates');
      console.log('Endpoints:');
      console.log('  POST   /payment_intents');
      console.log('  GET    /payment_intents/:id/status');
      console.log('  GET    /merchants/:id/payments');
      console.log('  POST   /transactions/notify (broadcasts to WebSocket)');
      console.log('  GET    /health\n');
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down gracefully...');
      cleanup();
      server.close(() => {
        console.log('✓ Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
