# Transaction Recording System

## Overview

When the HCE Sender app scans a phone or completes a successful payment that redirects to a wallet, the system automatically records all transaction information and displays it in the frontend graphs and tables.

## Transaction Flow

### 1. Payment Initiation (Android App)
When a customer scans NFC or clicks payment URL:
- HCE Sender creates payment intent
- Customer is redirected to wallet (Phantom/MetaMask)
- Customer confirms transaction in wallet

### 2. Transaction Recording (Android App → Backend)
After successful payment confirmation:
- Android app sends complete transaction details to backend
- All required fields are included:
  - **Time**: Current timestamp
  - **Amount (USDC)**: Payment amount
  - **Chain**: SOL, ETH, or BASE
  - **Tip**: Tip amount (if any)
  - **Transaction Signature**: Blockchain transaction hash
  - **Status**: "paid"

### 3. Backend Storage
Backend receives transaction via:
- `POST /transactions/notify` endpoint
- Stores in in-memory transaction store
- Logs all transaction details
- Makes available to frontend immediately

### 4. Frontend Display
Frontend automatically:
- Refreshes every 10 seconds
- Fetches all transactions from backend
- Displays in:
  - **Overview Page**: Metrics, pie charts, line charts, transaction table
  - **Analytics Page**: Daily sales, peak hours, chain performance
  - **Payments Page**: Full transaction table with filters

## Recorded Transaction Fields

Each transaction includes:

| Field | Description | Example |
|-------|-------------|---------|
| **Time** | Transaction timestamp | `2025-01-15T14:30:00.000Z` |
| **Amount (USDC)** | Payment amount in USDC | `100.50` |
| **Chain** | Blockchain network | `SOL`, `ETH`, or `BASE` |
| **Tip** | Tip amount (if any) | `5.00` |
| **Transaction Signature** | Blockchain transaction hash | `5KJp...xyz` |
| **Status** | Payment status | `paid` or `confirmed` |
| **Merchant ID** | Merchant identifier | `4UznnYY4...` |

## Implementation Details

### Android App (HceSender)

**File**: `HceSender/app/src/main/java/com/example/hcesender/MainActivity.kt`

**Function**: `sendTransactionNotification()`
- Called after payment confirmation
- Sends POST request to `/transactions/notify`
- Includes all transaction details

**Code Flow**:
```kotlin
1. Payment intent created → POST /payment_intents
2. Payment confirmed → POST /payment_intents/:id/confirm
3. Transaction notification → POST /transactions/notify
   - payment_intent_id
   - merchant_id
   - amount
   - chain
   - currency: "USDC"
   - tip_amount
   - tx_signature
   - status: "paid"
```

### Backend

**File**: `backend/src/index.js`

**Endpoint**: `POST /transactions/notify`
- Receives transaction notification
- Stores in transaction store
- Logs all details
- Returns stored transaction

**Transaction Store**: `backend/src/transactionStore.js`
- In-memory storage
- Organized by merchant ID
- Includes all required fields
- Auto-sorted by timestamp

### Frontend

**Files**:
- `frontend/src/components/pages/Overview.tsx`
- `frontend/src/components/pages/Analytics.tsx`
- `frontend/src/components/pages/Payments.tsx`

**Auto-refresh**: Every 10 seconds
- Fetches from `GET /merchants/:id/payments`
- Updates all charts and tables
- Shows latest transactions first

## Data Flow Diagram

```
┌─────────────────┐
│  HCE Sender App │
│  (Android)      │
└────────┬────────┘
         │
         │ 1. Create Payment Intent
         │    POST /payment_intents
         ▼
┌─────────────────┐
│   Backend API   │
│   (Node.js)     │
└────────┬────────┘
         │
         │ 2. Store Payment Intent
         │    (transaction store)
         │
         │ 3. Customer Completes Payment
         │    (in wallet)
         │
         │ 4. Transaction Notification
         │    POST /transactions/notify
         │    {amount, chain, tip, signature, ...}
         │
         │ 5. Store Complete Transaction
         │    (with all fields)
         ▼
┌─────────────────┐
│  Transaction     │
│  Store (Memory)  │
└────────┬────────┘
         │
         │ 6. Auto-refresh (every 10s)
         │    GET /merchants/:id/payments
         ▼
┌─────────────────┐
│   Frontend      │
│   (React)       │
└─────────────────┘
         │
         │ 7. Display in:
         │    - Overview charts
         │    - Analytics graphs
         │    - Payments table
         ▼
┌─────────────────┐
│   User Views    │
│   Dashboard     │
└─────────────────┘
```

## Testing

### Test Transaction Recording

1. **Start Backend**:
   ```powershell
   cd backend
   npm run dev
   ```

2. **Start Frontend**:
   ```powershell
   cd frontend
   npm run dev
   ```

3. **Run Android App**:
   - Open HceSender in Android Studio
   - Run on device/emulator
   - Enter payment amount
   - Select chain
   - Tap "Test Payment URL" or scan NFC

4. **Verify Recording**:
   - Check backend console for transaction logs
   - Check frontend dashboard (auto-refreshes)
   - Verify transaction appears in:
     - Overview page table
     - Analytics charts
     - Payments page

### Expected Backend Logs

```
✓ Payment intent created: abc-123-def
✓ Payment confirmed: abc-123-def
  - Amount: $100.50 USDC
  - Chain: SOL
  - Tip: $5.00
  - Signature: 5KJp...xyz
  - Time: 2025-01-15T14:30:00.000Z
✓ Transaction registered: abc-123-def
```

### Expected Frontend Display

- **Overview Page**:
  - Transaction appears in "Confirmed Transactions" table
  - Metrics update (Total Sales, Transactions, etc.)
  - Charts update (USDC Distribution, Sales Volume)

- **Analytics Page**:
  - Daily Sales chart updates
  - Peak Hours chart updates
  - Chain Performance table updates

- **Payments Page**:
  - Transaction appears in table
  - All fields visible: Time, Amount, Chain, Tip, Signature
  - Filters work correctly

## Troubleshooting

### Transaction Not Appearing

1. **Check Backend Logs**:
   - Verify transaction notification received
   - Check for errors in console

2. **Check Network**:
   - Ensure Android app can reach backend
   - Verify BACKEND_URL in MainActivity.kt

3. **Check Frontend**:
   - Verify auto-refresh is working (check network tab)
   - Check browser console for errors

### Missing Fields

1. **Verify Android App**:
   - Check `sendTransactionNotification()` is called
   - Verify all fields are included in payload

2. **Verify Backend**:
   - Check transaction store has all fields
   - Verify `/transactions/notify` endpoint works

3. **Verify Frontend**:
   - Check API response includes all fields
   - Verify frontend is displaying all fields

## Summary

✅ **Automatic Recording**: Transactions recorded automatically when payment completes
✅ **Complete Data**: All fields captured (Time, Amount, Chain, Tip, Signature)
✅ **Real-time Display**: Frontend auto-refreshes every 10 seconds
✅ **Multiple Views**: Data appears in Overview, Analytics, and Payments pages
✅ **No Manual Steps**: Fully automatic, no user intervention needed

