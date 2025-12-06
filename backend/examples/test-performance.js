#!/usr/bin/env node

/**
 * Performance and Load Testing
 * Tests throughput, latency, and system limits
 */

import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:3001';

class PerformanceTestRunner {
  constructor() {
    this.results = [];
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async measureLatency(name, fn, iterations = 10) {
    console.log(`\n📊 ${name}`);
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    console.log(`   Average: ${avg.toFixed(2)}ms`);
    console.log(`   Min: ${min.toFixed(2)}ms | Max: ${max.toFixed(2)}ms`);
    console.log(`   P95: ${p95.toFixed(2)}ms`);

    this.results.push({
      name,
      avg,
      min,
      max,
      p95,
    });
  }

  async measureThroughput(name, fn, duration = 5000) {
    console.log(`\n📊 ${name} (${duration}ms)`);
    const startTime = Date.now();
    let count = 0;
    let errors = 0;

    while (Date.now() - startTime < duration) {
      try {
        await fn();
        count++;
      } catch (error) {
        errors++;
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const rps = count / elapsed;

    console.log(`   Completed: ${count} requests`);
    console.log(`   Errors: ${errors}`);
    console.log(`   RPS: ${rps.toFixed(2)}`);

    this.results.push({
      name,
      count,
      errors,
      rps,
    });
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('Performance Test Summary');
    console.log('='.repeat(60));

    for (const result of this.results) {
      if (result.rps) {
        console.log(`\n${result.name}`);
        console.log(`  Completed: ${result.count} | Errors: ${result.errors} | RPS: ${result.rps.toFixed(2)}`);
      } else {
        console.log(`\n${result.name}`);
        console.log(`  Avg: ${result.avg.toFixed(2)}ms | P95: ${result.p95.toFixed(2)}ms`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

const runner = new PerformanceTestRunner();

// TEST 1: Create payment latency
await runner.measureLatency('Create payment latency', async () => {
  await fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 1000000,
      merchant_id: `perf-test-${Date.now()}`,
    }),
  });
}, 20);

// TEST 2: Get payment status latency
await runner.measureLatency(
  'Get payment status latency',
  async () => {
    // First create a payment
    const createRes = await fetch(`${BACKEND_URL}/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 1000000,
        merchant_id: `status-test-${Date.now()}`,
      }),
    });

    const payment = await createRes.json();

    // Then fetch status
    await fetch(`${BACKEND_URL}/payment_intents/${payment.id}/status`);
  },
  15
);

// TEST 3: Get merchant payments latency
await runner.measureLatency(
  'Get merchant payments latency',
  async () => {
    await fetch(`${BACKEND_URL}/merchants/perf-merchant/payments`);
  },
  20
);

// TEST 4: Health check latency
await runner.measureLatency('Health check latency', async () => {
  await fetch(`${BACKEND_URL}/health`);
}, 30);

// Wait for system to cool down
console.log('\n⏳ Cooling down for 2 seconds...\n');
await runner.sleep(2000);

// TEST 5: Payment creation throughput
await runner.measureThroughput(
  'Payment creation throughput',
  async () => {
    await fetch(`${BACKEND_URL}/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 1000000,
        merchant_id: `throughput-test-${Date.now()}`,
      }),
    });
  },
  5000
);

// TEST 6: Status check throughput
await runner.measureThroughput(
  'Status check throughput',
  async () => {
    await fetch(`${BACKEND_URL}/payment_intents/550e8400-e29b-41d4-a716-446655440000/status`);
  },
  5000
);

// TEST 7: Mixed workload (60% creates, 40% status checks)
await runner.measureThroughput(
  'Mixed workload throughput',
  async () => {
    const random = Math.random();

    if (random < 0.6) {
      // Create payment
      await fetch(`${BACKEND_URL}/payment_intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1000000,
          merchant_id: `mixed-test-${Date.now()}`,
        }),
      });
    } else {
      // Check status
      await fetch(`${BACKEND_URL}/payment_intents/550e8400-e29b-41d4-a716-446655440000/status`);
    }
  },
  5000
);

// Wait for cooldown
console.log('\n⏳ Cooling down for 2 seconds...\n');
await runner.sleep(2000);

// TEST 8: Burst load (100 concurrent requests)
console.log('\n📊 Burst load test (100 concurrent requests)');
const burstStart = performance.now();
const burstPromises = Array.from({ length: 100 }, () =>
  fetch(`${BACKEND_URL}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 1000000,
      merchant_id: `burst-test-${Date.now()}`,
    }),
  }).catch(() => ({ ok: false }))
);

const burstResponses = await Promise.all(burstPromises);
const burstEnd = performance.now();
const burstSuccessful = burstResponses.filter(r => r.ok).length;
const burstDuration = burstEnd - burstStart;

console.log(`   Successful: ${burstSuccessful}/100`);
console.log(`   Duration: ${burstDuration.toFixed(2)}ms`);
console.log(`   Avg per request: ${(burstDuration / 100).toFixed(2)}ms`);

runner.results.push({
  name: 'Burst load (100 concurrent)',
  successful: burstSuccessful,
  duration: burstDuration,
});

// TEST 9: Connection reuse efficiency
console.log('\n📊 Connection reuse efficiency test');
const reuseStart = performance.now();

const reusePromises = Array.from({ length: 50 }, () =>
  fetch(`${BACKEND_URL}/health`)
);

const reuseEnd = performance.now();
await Promise.all(reusePromises);
const reuseDuration = reuseEnd - reuseStart;

console.log(`   50 health checks: ${reuseDuration.toFixed(2)}ms`);
console.log(`   Avg per request: ${(reuseDuration / 50).toFixed(2)}ms`);

// TEST 10: Database query efficiency
console.log('\n📊 Database query efficiency');
const dbStart = performance.now();

// Create a payment then query it many times
const createRes = await fetch(`${BACKEND_URL}/payment_intents`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 1000000,
    merchant_id: 'db-efficiency-test',
  }),
});

const payment = await createRes.json();
const queryStart = performance.now();

const queryPromises = Array.from({ length: 50 }, () =>
  fetch(`${BACKEND_URL}/payment_intents/${payment.id}/status`)
);

await Promise.all(queryPromises);
const queryEnd = performance.now();
const dbEnd = performance.now();

console.log(`   Create: ${queryStart - dbStart}ms`);
console.log(`   50 queries: ${queryEnd - queryStart}ms`);
console.log(`   Avg per query: ${((queryEnd - queryStart) / 50).toFixed(2)}ms`);

runner.printSummary();

// Exit with success
process.exit(0);
