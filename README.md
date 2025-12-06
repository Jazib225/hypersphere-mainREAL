# Tap-to-Pay - Solana Payment System

A full-stack payment processing system built on Solana blockchain, supporting multi-chain USDC payments via NFC, web interfaces, and merchant dashboards.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup](#setup)
4. [Local Development](#local-development)
5. [Running Android Apps (Tap-to-Pay)](#running-android-apps-tap-to-pay)
6. [API Reference](#api-reference)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

## Overview

This system enables merchants to accept cryptocurrency payments through:
- **NFC-enabled Android devices** for tap-to-pay functionality
- **Web payment pages** for online transactions
- **Merchant dashboard** for payment management and analytics
- **Multi-chain support** for SOL, USDC on Solana, Ethereum, and Base networks

### Key Features

- ✅ Real-time payment processing on Solana blockchain
- ✅ Multi-chain USDC support (Solana, Ethereum, Base)
- ✅ NFC tap-to-pay for Android devices
- ✅ Web-based payment interface
- ✅ Merchant dashboard with analytics
- ✅ On-chain payment intent tracking via Solana Program Derived Addresses (PDAs)
- ✅ Transaction verification and status monitoring

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  • Merchant Dashboard (Analytics, Payments, Settings)        │
│  • Payment Pages (Web-based payment interface)               │
└────────────────────────┬────────────────────────────────────┘
                         │
                    HTTP (REST API)
                         │
        ┌────────────────▼────────────────┐
        │  Node.js Express Backend         │
        │  • Payment Intent Management     │
        │  • Merchant Management            │
        │  • Solana Integration             │
        │  • Database (SQLite)              │
        └──────────────┬───────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │   Solana Blockchain        │
        │  • tap_to_pay Program      │
        │  • PaymentIntent PDAs      │
        │  • Transaction Verification│
        └────────────────────────────┘
```

### Technology Stack

**Backend:**
- Node.js + Express.js
- SQLite3 (database)
- @solana/web3.js (blockchain integration)
- TypeScript (optional)

**Frontend:**
- React + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Recharts (data visualization)
- React Router (routing)

**Blockchain:**
- Solana (main network)
- Anchor Framework (Solana program)
- Rust (Solana program language)

**Android:**
- Kotlin
- NFC API
- Android SDK

## Setup

### Prerequisites

- **Node.js** 18+ and npm
- **Git** for version control
- **Solana CLI** (optional, for program deployment)
- **Android Studio** (required for Android development)
- **2 Android phones with NFC support** (required for tap-to-pay functionality)
  - One phone for the merchant app
  - One phone for the customer app (NfcReader)

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd ttp
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Configure environment variables:**

   Create `backend/.env`:
   ```env
   # Solana Configuration
   SOLANA_RPC_URL=https://api.devnet.solana.com
   PROGRAM_ID=3fJqtvkQLR45CVT83LqRP8hefjkXxAjKZ4e1N4QdHKMR
   
   # Server Configuration
   PORT=3001
   BASE_URL=http://localhost:3001
   
   # Optional: USDC Configuration
   # USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
   # USDC_DECIMALS=6
   ```

   Create `frontend/.env` (optional):
   ```env
   VITE_API_URL=http://localhost:3001
   ```

5. **Initialize the database:**
   The database will be automatically created on first backend startup at `backend/data/payments.db`

## Local Development

### Running the Backend

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

3. **Verify backend is running:**
   - Server should start on `http://localhost:3001`
   - Health check: `http://localhost:3001/health`
   - You should see:
     ```
     ✓ Database initialized
     ✓ Connected to Solana: <version>
     🚀 Backend server running on http://localhost:3001
     ```

### Running the Frontend

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Frontend will be available at `http://localhost:5173` (or the port shown in terminal)
   - Open in your browser to access the merchant dashboard

### Running Both Services

**Option 1: Separate Terminals**

Terminal 1 (Backend):
```bash
cd backend
npm start
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

**Option 2: Using a Process Manager**

You can use tools like `concurrently` or `npm-run-all` to run both services together.

### Running Android Apps (Tap-to-Pay)

**Requirements:**
- 2 Android phones with NFC support
- Android Studio installed
- Backend server running (see [Running the Backend](#running-the-backend))

**Setup Steps:**

1. **Open Android Studio:**
   - Launch Android Studio
   - Open the project directory

2. **Build and Install Merchant App:**
   ```bash
   cd android
   ./gradlew assembleDebug
   ./gradlew installDebug
   ```
   - Or use Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Install on **Phone 1** (Merchant phone)

3. **Build and Install Customer App (NfcReader):**
   ```bash
   cd NfcReader
   ./gradlew assembleDebug
   ./gradlew installDebug
   ```
   - Or use Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Install on **Phone 2** (Customer phone)

4. **Configure Backend URL:**
   - In the merchant app (`android/app/src/main/java/.../MainActivity.kt`), update:
     ```kotlin
     private const val BACKEND_URL = "http://YOUR_IP:3001"
     ```
   - Replace `YOUR_IP` with your computer's local IP address (e.g., `192.168.1.100`)
   - Rebuild and reinstall the merchant app

5. **Testing Tap-to-Pay:**
   - Ensure both phones have NFC enabled
   - On **Phone 1** (Merchant): Open merchant app, enter payment amount, tap "Create Payment"
   - On **Phone 2** (Customer): Open NfcReader app, keep it in foreground
   - Tap the two phones together (back-to-back)
   - Customer phone should receive the payment URL and open it in a compatible wallet (Phantom, MetaMask, etc.)
   - Complete the payment in your wallet
   - Merchant app will show "Payment Received" when confirmed

**Note:** Both phones must be on the same local network as your backend server, or use a publicly accessible backend URL.

## Architecture Overview

### Backend Architecture

**Core Components:**

1. **Express Server** (`backend/src/index.js`)
   - REST API endpoints
   - Request handling and routing
   - Middleware (CORS, JSON parsing)
   - Error handling

2. **Database Layer** (`backend/src/database.js`)
   - SQLite3 database management
   - Tables:
     - `payment_intents`: Payment records with status, amounts, chains
     - `merchants`: Merchant profiles and settings
   - CRUD operations for payments and merchants

3. **Solana Integration** (`backend/src/solanaListener.js`)
   - Solana RPC connection management
   - Program Derived Address (PDA) derivation
   - Account data decoding (Borsh format)
   - WebSocket subscriptions for real-time updates
   - Transaction signature verification

4. **Solana Program** (`programs/tap_to_pay/src/lib.rs`)
   - On-chain payment intent storage
   - Payment processing instructions
   - Event emission for payment confirmations

### Frontend Architecture

**Component Structure:**

1. **Pages** (`frontend/src/components/pages/`)
   - `Overview.tsx`: Dashboard overview with metrics and charts
   - `Payments.tsx`: Payment list with filtering
   - `Analytics.tsx`: Payment analytics and insights
   - `Balances.tsx`: Multi-chain balance tracking
   - `Settings.tsx`: Merchant settings and configuration

2. **Utilities** (`frontend/src/utils/`)
   - `api.ts`: Backend API communication
   - `routes.ts`: Route definitions

3. **UI Components** (`frontend/src/components/ui/`)
   - Reusable UI components (buttons, cards, tables, etc.)
   - Built with Radix UI and Tailwind CSS

### Data Flow

**Payment Creation Flow:**

1. Merchant creates payment intent via API
2. Backend generates unique payment ID and nonce
3. Payment intent saved to database
4. PDA (Program Derived Address) derived for on-chain storage
5. Payment URL returned to merchant
6. Backend starts monitoring PDA for status changes

**Payment Processing Flow:**

1. Customer accesses payment URL
2. Customer connects wallet (Phantom, MetaMask, or any compatible wallet)
3. Customer approves transaction
4. Transaction sent to Solana network
5. Backend WebSocket listener detects account change
6. Payment status updated in database
7. Merchant dashboard reflects confirmed payment

### Database Schema

**payment_intents table:**
- `id`: Unique payment intent identifier (UUID)
- `amount`: Payment amount in smallest unit
- `merchant_id`: Merchant identifier
- `nonce`: Security nonce (32 bytes)
- `payment_url`: URL for payment page
- `status`: Payment status (confirmed, pending, etc.)
- `tx_signature`: Transaction signature from blockchain
- `currency`: Currency type (SOL, USDC)
- `chain`: Blockchain network (SOL, BASE, ETH)
- `token_mint`: Token mint address (for USDC)
- `recipient_address`: Recipient wallet address
- `tip_amount`: Optional tip amount
- `created_at`, `updated_at`: Timestamps

**merchants table:**
- `id`: Merchant identifier
- `name`: Business name
- `wallet_address`: Default wallet address
- `email`: Contact email
- `business_type`: Type of business
- `solana_address`: Solana wallet address
- `base_address`: Base network wallet address
- `ethereum_address`: Ethereum wallet address
- `preferred_chain`: Preferred blockchain (SOL, BASE, ETH)
- `created_at`, `updated_at`: Timestamps

## API Reference

### Payment Intents

**Create Payment Intent**
```
POST /payment_intents
Content-Type: application/json

{
  "amount": 1000000,
  "merchant_id": "merchant-123",
  "currency": "SOL",  // optional, defaults to SOL
  "chain": "SOL",     // optional, defaults to SOL
  "tip_amount": 0     // optional
}

Response:
{
  "id": "uuid-here",
  "amount": 1000000,
  "merchant_id": "merchant-123",
  "payment_url": "http://localhost:3001/payment/uuid-here",
  "nonce": "hex-nonce",
  "pda": "PDA-address",
  "bump": 255
}
```

**Get Payment Status**
```
GET /payment_intents/:id/status

Response:
{
  "id": "uuid-here",
  "status": "confirmed",
  "tx_signature": "transaction-signature",
  "amount": 1000000,
  "chain": "SOL",
  "currency": "SOL",
  "on_chain": true,
  "pda": "PDA-address"
}
```

**Confirm Payment**
```
POST /payment_intents/:id/confirm
Content-Type: application/json

{
  "tx_signature": "transaction-signature-from-blockchain"
}
```

### Merchants

**Get Merchant Payments**
```
GET /merchants/:id/payments

Response:
{
  "merchant_id": "merchant-123",
  "total_count": 100,
  "payments": [...]
}
```

**Get Merchant Settings**
```
GET /merchants/:id/settings

Response:
{
  "id": "merchant-123",
  "name": "Business Name",
  "email": "email@example.com",
  "solana_address": "address...",
  "preferred_chain": "SOL"
}
```

**Update Merchant Settings**
```
PUT /merchants/:id/settings
Content-Type: application/json

{
  "name": "New Business Name",
  "email": "new@example.com",
  "solana_address": "new-address",
  "preferred_chain": "SOL"
}
```

### Health Check

```
GET /health

Response:
{
  "status": "ok"
}
```

## Deployment

### Backend Deployment

**Environment Variables Required:**
- `SOLANA_RPC_URL`: Solana RPC endpoint
- `PROGRAM_ID`: Deployed Solana program ID
- `PORT`: Server port (default: 3001)
- `BASE_URL`: Base URL for the backend

**Deployment Platforms:**
- Railway
- Heroku
- AWS EC2
- Any Node.js hosting service

### Frontend Deployment

**Environment Variables:**
- `VITE_API_URL`: Backend API URL

**Deployment Platforms:**
- Vercel (recommended)
- Netlify
- Any static hosting service

### Solana Program Deployment

The Solana program is deployed on **Solana Devnet** with Program ID:
```
3fJqtvkQLR45CVT83LqRP8hefjkXxAjKZ4e1N4QdHKMR
```

**View on Explorer:**
- [Solana Explorer (Devnet)](https://explorer.solana.com/address/3fJqtvkQLR45CVT83LqRP8hefjkXxAjKZ4e1N4QdHKMR?cluster=devnet)
- [Solscan (Devnet)](https://solscan.io/account/3fJqtvkQLR45CVT83LqRP8hefjkXxAjKZ4e1N4QdHKMR?cluster=devnet)

## Troubleshooting

### Backend Issues

**Database errors:**
- Ensure `backend/data/` directory exists and is writable
- Check file permissions on `payments.db`

**Solana connection errors:**
- Verify `SOLANA_RPC_URL` in `.env` is correct
- Check internet connection
- Try a different RPC endpoint if rate-limited

**Program ID errors:**
- Verify `PROGRAM_ID` in `.env` matches deployed program
- Ensure program is deployed on the same network (devnet/mainnet)

### Frontend Issues

**API connection errors:**
- Verify `VITE_API_URL` points to running backend
- Check CORS settings on backend
- Ensure backend is running before starting frontend

**Build errors:**
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check Node.js version (18+ required)

### Common Issues

**Port already in use:**
- Change `PORT` in backend `.env`
- Or kill the process using the port

**Database locked:**
- Ensure only one backend instance is running
- Close any database viewers (DB Browser, etc.)

**Payment status not updating:**
- Check Solana RPC connection
- Verify WebSocket subscriptions are working
- Check backend logs for errors

## License

MIT
