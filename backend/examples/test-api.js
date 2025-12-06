/**
 * Test script for Tap-to-Pay API
 * Run from backend directory: node examples/test-api.js
 */

const BASE_URL = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAPI() {
  console.log('🧪 Testing Tap-to-Pay API\n');

  try {
    // Test 1: Health check
    console.log('1️⃣  Testing health endpoint...');
    let response = await fetch(`${BASE_URL}/health`);
    let data = await response.json();
    console.log('✓ Health:', data, '\n');

    // Test 2: Create payment intent
    console.log('2️⃣  Creating payment intent...');
    response = await fetch(`${BASE_URL}/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 1000000,
        merchant_id: 'test-merchant-001',
      }),
    });
    data = await response.json();
    console.log('✓ Created:', data);
    const paymentIntentId = data.id;
    console.log();

    // Test 3: Get payment status (should be pending)
    console.log('3️⃣  Checking payment status (should be pending)...');
    response = await fetch(`${BASE_URL}/payment_intents/${paymentIntentId}/status`);
    data = await response.json();
    console.log('✓ Status:', data, '\n');

    // Test 4: Get merchant payments
    console.log('4️⃣  Getting merchant dashboard...');
    response = await fetch(`${BASE_URL}/merchants/test-merchant-001/payments`);
    data = await response.json();
    console.log('✓ Merchant Payments:', data, '\n');

    // Test 5: Get payment page
    console.log('5️⃣  Getting payment page...');
    response = await fetch(`${BASE_URL}/pay/${paymentIntentId}`);
    data = await response.json();
    console.log('✓ Payment Page:', data, '\n');

    // Test 6: Create another payment
    console.log('6️⃣  Creating another payment intent...');
    response = await fetch(`${BASE_URL}/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 5000000,
        merchant_id: 'test-merchant-001',
      }),
    });
    data = await response.json();
    console.log('✓ Created:', data, '\n');

    // Test 7: Get updated merchant payments
    console.log('7️⃣  Getting updated merchant dashboard...');
    response = await fetch(`${BASE_URL}/merchants/test-merchant-001/payments`);
    data = await response.json();
    console.log('✓ Updated Merchant Payments:', data, '\n');

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testAPI();
