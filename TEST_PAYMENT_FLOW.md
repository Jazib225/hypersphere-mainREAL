# Test Payment URL Flow - How It Works

## When You Click "Test Payment URL" Button

### Step-by-Step Flow:

1. **Button Clicked** → `testPaymentUrl()` is called
2. **Wallet Opens** → Payment URL opens in wallet app (Phantom/MetaMask)
3. **Transaction Recorded** → After 1.5 seconds, `sendPaymentToBackend()` is called
4. **Payment Intent Created** → Backend creates payment intent with:
   - Amount (from app)
   - Chain (SOL/ETH/BASE - from selected chain)
   - Tip amount (from app)
   - Merchant ID
5. **Transaction Confirmed** → Backend confirms payment with transaction signature
6. **Notification Sent** → Android app sends complete transaction notification:
   - Payment Intent ID
   - Amount
   - Chain
   - Tip
   - Transaction Signature
   - Status: "paid"
7. **Backend Stores** → Transaction stored in memory with all details
8. **Frontend Updates** → Frontend auto-refreshes (every 10 seconds) and displays transaction

## What Gets Recorded

When you click "Test Payment URL" with:
- **Amount**: $50.00
- **Chain**: SOL (or ETH/BASE)
- **Tip**: $5.00

The system records:
- ✅ **Time**: Current timestamp
- ✅ **Amount**: $50.00 USDC
- ✅ **Chain**: SOL (or ETH/BASE)
- ✅ **Tip**: $5.00
- ✅ **Transaction Signature**: Generated signature
- ✅ **Status**: "paid"

## How to Verify It's Working

### 1. Check Android Logs (Logcat)
Look for these messages:
```
📤 SENDING PAYMENT TO BACKEND
  Amount: $50.0
  Tip: $5.0
  Chain: SOL
✅ Payment intent created: [uuid]
✓ Payment confirmed successfully
✓✓✓ TRANSACTION NOTIFICATION SENT SUCCESSFULLY ✓✓✓
```

### 2. Check Backend Console
You should see:
```
✓ Payment intent created: [uuid] for merchant [merchant_id]
✓ Payment confirmed: [uuid]
✓✓✓ TRANSACTION RECORDED ✓✓✓
  ID: [uuid]
  Amount: $50 USDC
  Chain: SOL
  Tip: $5
  Signature: [signature]...
  Time: [timestamp]
✓✓✓ Transaction will appear in frontend within 10 seconds ✓✓✓
```

### 3. Check Frontend
- Wait 10 seconds (or refresh page)
- Transaction should appear in:
  - Overview page table
  - Analytics charts
  - Payments page table

### 4. Check Debug Endpoint
Visit: `http://localhost:3001/debug/transactions?merchant_id=4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U`

You should see your transaction in `merchant_transactions_list`.

## Troubleshooting

### Transaction Not Appearing?

1. **Check Android Logs**:
   - Open Android Studio → Logcat
   - Filter by "MainActivity" or "HceSender"
   - Look for error messages

2. **Check Backend Console**:
   - Look for "✓✓✓ TRANSACTION RECORDED ✓✓✓" message
   - If you don't see it, the notification wasn't received

3. **Check Network**:
   - Verify BACKEND_URL in MainActivity.kt is correct
   - For emulator: `http://10.0.2.2:3001`
   - For physical device: `http://YOUR_IP:3001`

4. **Check Merchant ID**:
   - Android: `4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U`
   - Frontend: `4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U`
   - Must match exactly!

5. **Manual Refresh**:
   - Frontend auto-refreshes every 10 seconds
   - Or manually refresh the browser page

## Expected Behavior

✅ Click "Test Payment URL" → Wallet opens
✅ Transaction automatically recorded (after 1.5 seconds)
✅ Backend console shows transaction details
✅ Frontend shows transaction within 10 seconds
✅ All fields populated: Time, Amount, Chain, Tip, Signature

## Code Flow

```
User clicks "Test Payment URL"
    ↓
testPaymentUrl() called
    ↓
Wallet URL opens
    ↓
(1.5 second delay)
    ↓
sendPaymentToBackend() called
    ↓
POST /payment_intents (create payment intent)
    ↓
POST /payment_intents/:id/confirm (confirm payment)
    ↓
sendTransactionNotification() called
    ↓
POST /transactions/notify (record transaction)
    ↓
Backend stores transaction
    ↓
Frontend auto-refreshes
    ↓
Transaction appears in tables and charts
```

## Summary

The system is **fully automatic**. When you click "Test Payment URL":
1. Wallet opens
2. Transaction is automatically recorded
3. All details captured (amount, chain, tip, signature)
4. Frontend displays it automatically

No manual steps needed! 🎉

