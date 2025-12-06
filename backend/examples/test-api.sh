#!/bin/bash
# Tap-to-Pay API Test Commands
# Use these curl commands to test the backend

BASE_URL="http://localhost:3001"

echo "🏥 Testing Tap-to-Pay Backend API"
echo ""

# Test 1: Health Check
echo "1️⃣  Health Check"
echo "curl $BASE_URL/health"
curl -X GET "$BASE_URL/health" | jq .
echo ""
echo ""

# Test 2: Create Payment Intent
echo "2️⃣  Create Payment Intent"
MERCHANT_ID="test-merchant-$(date +%s)"
echo "curl -X POST $BASE_URL/payment_intents \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"amount\": 1000000, \"merchant_id\": \"$MERCHANT_ID\"}'"
RESPONSE=$(curl -s -X POST "$BASE_URL/payment_intents" \
  -H "Content-Type: application/json" \
  -d "{\"amount\": 1000000, \"merchant_id\": \"$MERCHANT_ID\"}")
echo "$RESPONSE" | jq .
PAYMENT_ID=$(echo "$RESPONSE" | jq -r '.id')
echo ""
echo "Payment Intent ID: $PAYMENT_ID"
echo ""
echo ""

# Test 3: Get Payment Status (Pending)
echo "3️⃣  Get Payment Status (Should be pending)"
echo "curl $BASE_URL/payment_intents/$PAYMENT_ID/status"
curl -s -X GET "$BASE_URL/payment_intents/$PAYMENT_ID/status" | jq .
echo ""
echo ""

# Test 4: Get Payment Page
echo "4️⃣  Get Payment Page"
echo "curl $BASE_URL/pay/$PAYMENT_ID"
curl -s -X GET "$BASE_URL/pay/$PAYMENT_ID" | jq .
echo ""
echo ""

# Test 5: Get Merchant Payments
echo "5️⃣  Get Merchant Payments (Dashboard)"
echo "curl $BASE_URL/merchants/$MERCHANT_ID/payments"
curl -s -X GET "$BASE_URL/merchants/$MERCHANT_ID/payments" | jq .
echo ""
echo ""

# Test 6: Create Another Payment
echo "6️⃣  Create Another Payment"
echo "curl -X POST $BASE_URL/payment_intents \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"amount\": 5000000, \"merchant_id\": \"$MERCHANT_ID\"}'"
RESPONSE2=$(curl -s -X POST "$BASE_URL/payment_intents" \
  -H "Content-Type: application/json" \
  -d "{\"amount\": 5000000, \"merchant_id\": \"$MERCHANT_ID\"}")
echo "$RESPONSE2" | jq .
echo ""
echo ""

# Test 7: Updated Merchant Dashboard
echo "7️⃣  Updated Merchant Dashboard (Should have 2 payments)"
echo "curl $BASE_URL/merchants/$MERCHANT_ID/payments"
curl -s -X GET "$BASE_URL/merchants/$MERCHANT_ID/payments" | jq .
echo ""
echo ""

echo "✅ API Tests Complete!"
echo ""
echo "To simulate a payment confirmation, you would need to:"
echo "1. Call the tap_to_pay::pay_invoice instruction on Solana"
echo "2. Pass the payment_intent_id and nonce from the payment intent"
echo "3. The backend listener will detect the change and update the database"
