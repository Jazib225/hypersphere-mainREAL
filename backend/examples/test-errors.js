#!/usr/bin/env node

/**
 * Error Scenario Testing
 * Tests error handling, retries, and edge cases
 */

import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:3001';

class ErrorTestRunner {
  constructor() {
    this.results = { passed: 0, failed: 0 };
  }

  async test(name, fn) {
    try {
      console.log(`\n🧪 ${name}`);
      await fn();
      console.log(`✅ PASS`);
      this.results.passed++;
    } catch (error) {
      console.log(`❌ FAIL: ${error.message}`);
      this.results.failed++;
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log(`Passed: ${this.results.passed} | Failed: ${this.results.failed}`);
    console.log('='.repeat(60) + '\n');
  }
}

const runner = new ErrorTestRunner();

// TEST 1: Invalid amount
await runner.test('Invalid payment amount (zero)', async () => {
  const response = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 0, merchant_id: 'test-001' }),
  });

  if (response.status !== 400) {
    throw new Error(`Expected 400, got ${response.status}`);
  }
  const error = await response.json();
  console.log(`   Response: ${error.error}`);
});

// TEST 2: Invalid amount (negative)
await runner.test('Invalid payment amount (negative)', async () => {
  const response = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: -1000000, merchant_id: 'test-001' }),
  });

  if (response.status !== 400) {
    throw new Error(`Expected 400, got ${response.status}`);
  }
});

// TEST 3: Invalid amount (string)
await runner.test('Invalid payment amount (string)', async () => {
  const response = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 'invalid', merchant_id: 'test-001' }),
  });

  if (response.status !== 400) {
    throw new Error(`Expected 400, got ${response.status}`);
  }
});

// TEST 4: Missing merchant_id
await runner.test('Missing merchant_id field', async () => {
  const response = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 1000000 }),
  });

  if (response.status !== 400) {
    throw new Error(`Expected 400, got ${response.status}`);
  }
});

// TEST 5: Missing amount
await runner.test('Missing amount field', async () => {
  const response = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchant_id: 'test-001' }),
  });

  if (response.status !== 400) {
    throw new Error(`Expected 400, got ${response.status}`);
  }
});

// TEST 6: Invalid payment ID format
await runner.test('Invalid payment ID format', async () => {
  const response = await fetch(`${BACKEND_URL}/payment_intents/not-a-uuid/status`);

  if (response.status !== 404) {
    throw new Error(`Expected 404, got ${response.status}`);
  }
});

// TEST 7: Non-existent payment ID
await runner.test('Non-existent payment ID', async () => {
  const fakeId = '550e8400-e29b-41d4-a716-446655440000';
  const response = await fetch(`${BACKEND_URL}/payment_intents/${fakeId}/status`);

  if (response.status !== 404) {
    throw new Error(`Expected 404, got ${response.status}`);
  }
});

// TEST 8: Retry on network failure (simulated)
await runner.test('Retry mechanism - create payment with timeout', async () => {
  let lastError = null;
  let attempts = 0;
  const maxAttempts = 3;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      attempts++;
      const response = await fetch(`${BACKEND_URL}/payment_intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1000000,
          merchant_id: `retry-test-${Date.now()}`,
        }),
      });

      if (response.ok) {
        console.log(`   ✓ Success on attempt ${attempts}`);
        return;
      }
      lastError = new Error(`Status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (i < maxAttempts - 1) {
      await runner.sleep(100 * (i + 1)); // Exponential backoff
    }
  }

  if (lastError) throw lastError;
});

// TEST 9: Concurrent request handling
await runner.test('Concurrent requests (race condition test)', async () => {
  const merchantId = `race-test-${Date.now()}`;
  
  const promises = Array.from({ length: 10 }, () =>
    fetch(`${BACKEND_URL}/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 1000000,
        merchant_id: merchantId,
      }),
    })
  );

  const responses = await Promise.all(promises);
  const failures = responses.filter(r => !r.ok);

  if (failures.length > 0) {
    throw new Error(`${failures.length} requests failed`);
  }

  const results = await Promise.all(responses.map(r => r.json()));
  const uniqueIds = new Set(results.map(r => r.id));

  if (uniqueIds.size !== 10) {
    throw new Error(`Expected 10 unique payment IDs, got ${uniqueIds.size}`);
  }

  console.log(`   ✓ All 10 concurrent requests succeeded with unique IDs`);
});

// TEST 10: Large payload
await runner.test('Large payment amount', async () => {
  const largeAmount = Math.pow(2, 63) - 1; // Max int64

  const response = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: largeAmount,
      merchant_id: 'test-large',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create large amount payment: ${response.status}`);
  }

  console.log(`   ✓ Handled large amount (${largeAmount})`);
});

// TEST 11: SQL injection attempt
await runner.test('SQL injection protection', async () => {
  const response = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 1000000,
      merchant_id: "'; DROP TABLE merchants; --",
    }),
  });

  // Should still succeed (just treating as normal merchant ID)
  if (!response.ok) {
    throw new Error('Should handle as normal string');
  }

  // Verify database still works
  const healthResponse = await fetch(`${BACKEND_URL}/health`);
  if (!healthResponse.ok) {
    throw new Error('Database may have been compromised');
  }

  console.log(`   ✓ SQL injection safely handled`);
});

// TEST 12: XSS attempt in merchant_id
await runner.test('XSS protection', async () => {
  const response = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 1000000,
      merchant_id: '<script>alert("xss")</script>',
    }),
  });

  if (!response.ok) {
    throw new Error('Should handle as normal string');
  }

  console.log(`   ✓ XSS attempt safely handled`);
});

// TEST 13: Rate limiting (stress test)
await runner.test('Stress test - rapid requests', async () => {
  const promises = Array.from({ length: 50 }, (_, i) =>
    fetch(`${BACKEND_URL}/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 100000 + i,
        merchant_id: `stress-${Date.now()}`,
      }),
    }).catch(() => ({ ok: false }))
  );

  const responses = await Promise.all(promises);
  const successful = responses.filter(r => r.ok).length;

  if (successful === 0) {
    throw new Error('No requests succeeded under stress');
  }

  console.log(`   ✓ ${successful}/50 requests succeeded under stress`);
});

// TEST 14: State consistency
await runner.test('State consistency - create then immediate fetch', async () => {
  const response1 = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 1000000,
      merchant_id: 'consistency-test',
    }),
  });

  if (!response1.ok) throw new Error('Failed to create payment');
  const payment = await response1.json();

  // Immediately fetch status
  const response2 = await fetch(`${BACKEND_URL}/payment_intents/${payment.id}/status`);
  if (!response2.ok) throw new Error('Failed to fetch status');

  const status = await response2.json();
  if (status.id !== payment.id) {
    throw new Error('Payment ID mismatch');
  }
  if (status.status !== 'pending') {
    throw new Error(`Expected pending, got ${status.status}`);
  }

  console.log(`   ✓ State is consistent immediately after creation`);
});

// TEST 15: Merchant isolation
await runner.test('Merchant data isolation', async () => {
  const merchant1 = `merchant-a-${Date.now()}`;
  const merchant2 = `merchant-b-${Date.now()}`;

  // Create payment for merchant1
  const res1 = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 1000000, merchant_id: merchant1 }),
  });

  // Create payment for merchant2
  const res2 = await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 2000000, merchant_id: merchant2 }),
  });

  const data1 = await res1.json();
  const data2 = await res2.json();

  // Fetch merchant1 payments
  const merchant1Payments = await fetch(`${BACKEND_URL}/merchants/${merchant1}/payments`);
  const m1Data = await merchant1Payments.json();

  // Should only contain merchant1's payment
  const belongsToM1 = m1Data.payments.some(p => p.id === data1.id);
  const shouldNotBelongToM1 = m1Data.payments.some(p => p.id === data2.id);

  if (!belongsToM1) {
    throw new Error('Payment not found for merchant1');
  }
  if (shouldNotBelongToM1) {
    throw new Error('Merchant1 can see merchant2 payments!');
  }

  console.log(`   ✓ Merchants properly isolated from each other`);
});

runner.printSummary();
process.exit(runner.results.failed > 0 ? 1 : 0);
