# Automatic Transaction Capture System

This system automatically captures and displays all transactions from merchant devices without requiring a database.

## How It Works

### 1. Payment Intent Creation
When a payment intent is created via `POST /payment_intents`:
- Transaction is automatically stored in memory
- Payment watcher is set up to monitor on-chain status
- Payment URL is generated for the customer

### 2. Customer Payment Flow
When a customer scans NFC or clicks the payment URL:
- They are redirected to their wallet (Phantom for Solana, MetaMask for EVM chains)
- The `/pay/:id` endpoint is called, which:
  - Stores the transaction if not already stored
  - Sets up automatic payment monitoring
  - Returns payment details

### 3. Automatic Transaction Detection
The system uses multiple methods to detect completed transactions:

#### a) On-Chain Watchers
- Solana: Real-time account change listeners
- Automatically updates transaction status when payment is confirmed

#### b) Automatic Polling
- Polls every 10 seconds for pending transactions
- Checks on-chain status and updates stored transactions
- Works for all chains (Solana, Ethereum, Base)

#### c) Transaction Notification Endpoint
- `POST /transactions/notify` - Can receive webhooks from wallets
- Allows external systems to notify the backend of completed transactions

### 4. Frontend Display
- Frontend automatically refreshes every 10 seconds
- Displays all transactions from the in-memory store
- Shows transaction details: amount, chain, tip, signature, status

## Starting the System

### Windows (PowerShell)
```powershell
# Start both backend and frontend
.\start-all.ps1

# Or start individually
.\start-backend.ps1
.\start-frontend.ps1
```

### Linux/Mac (Bash)
```bash
# Start both backend and frontend
./start-all.sh

# Or start individually
./start-backend.sh
./start-frontend.sh
```

## Endpoints

### Backend (http://localhost:3001)

- `POST /payment_intents` - Create a new payment intent
- `GET /payment_intents/:id/status` - Get payment intent status
- `POST /payment_intents/:id/confirm` - Confirm a payment with transaction signature
- `GET /merchants/:id/payments` - Get all payments for a merchant
- `GET /pay/:id` - Payment page (called when user scans/clicks payment URL)
- `POST /transactions/notify` - Register a transaction notification
- `GET /health` - Health check

### Frontend (http://localhost:5173)

- Automatically displays all transactions for the configured merchant
- Auto-refreshes every 10 seconds
- Supports filtering by chain, date, tip, and amount range

## Transaction Flow Example

1. **Merchant Device** creates payment intent:
   ```
   POST /payment_intents
   {
     "amount": 100,
     "merchant_id": "4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U",
     "chain": "SOL",
     "currency": "USDC"
   }
   ```

2. **Customer** scans NFC or clicks payment URL:
   - Opens wallet app (Phantom/MetaMask)
   - Confirms transaction

3. **Backend** automatically:
   - Detects transaction via on-chain watcher or polling
   - Updates transaction status to "paid"
   - Stores transaction signature

4. **Frontend** automatically:
   - Refreshes and displays the new transaction
   - Shows all transaction details

## Features

✅ **No Database Required** - All transactions stored in memory
✅ **Automatic Detection** - Multiple methods ensure transactions are captured
✅ **Real-time Updates** - Frontend auto-refreshes every 10 seconds
✅ **Multi-chain Support** - Works with Solana, Ethereum, and Base
✅ **Automatic Startup** - Scripts handle everything automatically

## Notes

- Transactions are stored in memory and will be lost on server restart
- For production, consider adding persistent storage or database
- The system automatically handles payment intent creation, monitoring, and status updates
- All redirects and wallet integrations remain functional

