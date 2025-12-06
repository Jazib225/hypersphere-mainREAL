# Tap-to-Pay Merchant Android App

Quick Android merchant app for Solana tap-to-pay.

## Features

- **Amount Input**: Enter payment amount
- **Create Payment**: Calls backend to create payment intent
- **NFC Broadcast**: Broadcasts payment_url via NFC NDEF URI
- **Status Polling**: Checks payment status every 1 second
- **Confirmation**: Shows "Payment Received" when status = paid

## Setup

1. **Update Backend URL** in both activities:
   ```kotlin
   // MainActivity.kt & PaymentActivity.kt
   private const val BACKEND_URL = "http://YOUR_IP:3001"
   ```

2. **Build**:
   ```bash
   cd android
   ./gradlew build
   ```

3. **Run**:
   ```bash
   ./gradlew installDebug
   ```

## How It Works

1. User enters amount and taps "Create Payment"
2. App calls `POST /payment_intents` on backend
3. Backend returns payment_intent_id and payment_url
4. App switches to PaymentActivity and starts NFC broadcast
5. App polls `GET /payment_intents/:id/status` every 1 second
6. When status = "paid", shows "Payment Received" with tx signature
7. User can go back to create another payment

## Files

```
android/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/solana/taptopay/
│   │   │   ├── ui/
│   │   │   │   ├── MainActivity.kt       # Amount input screen
│   │   │   │   └── PaymentActivity.kt    # Payment/NFC screen
│   │   │   ├── network/
│   │   │   │   └── PaymentApiClient.kt   # API calls
│   │   │   └── nfc/
│   │   │       └── NfcManager.kt         # NFC broadcast
│   │   └── res/
│   │       ├── layout/
│   │       │   ├── activity_main.xml
│   │       │   └── activity_payment.xml
│   │       └── values/
│   │           ├── strings.xml
│   │           └── themes.xml
│   └── build.gradle
├── build.gradle
└── settings.gradle
```

## Permissions

- `android.permission.INTERNET` - API calls
- `android.permission.NFC` - NFC broadcast

## Testing

1. Start backend: `npm run dev`
2. Build & run app on emulator or device
3. Enter amount (e.g., 1000000)
4. Tap "Create Payment"
5. App broadcasts payment_url via NFC
6. Manually trigger payment on Solana (or test with backend test script)
7. Status should update and show "Payment Received"

## Note

Update `BACKEND_URL` to match your backend server's IP/URL.
