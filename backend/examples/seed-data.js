#!/usr/bin/env node
/**
 * Seed dummy data for testing
 * Creates test payments for merchant "test-merchant-123"
 */

import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:3001';
const MERCHANT_ID = 'test-merchant-123';

async function seedData() {
  console.log('🌱 Seeding test data for merchant dashboard...\n');

  // Create payments across different dates and amounts
  const payments = [
    { amount: 1000000, days_ago: 10 },   // 1 SOL, 10 days ago
    { amount: 2500000, days_ago: 9 },    // 2.5 SOL, 9 days ago
    { amount: 1500000, days_ago: 8 },    // 1.5 SOL, 8 days ago
    { amount: 3000000, days_ago: 7 },    // 3 SOL, 7 days ago
    { amount: 1200000, days_ago: 6 },    // 1.2 SOL, 6 days ago
    { amount: 2800000, days_ago: 5 },    // 2.8 SOL, 5 days ago
    { amount: 1800000, days_ago: 4 },    // 1.8 SOL, 4 days ago
    { amount: 4200000, days_ago: 3 },    // 4.2 SOL, 3 days ago
    { amount: 2100000, days_ago: 2 },    // 2.1 SOL, 2 days ago
    { amount: 3500000, days_ago: 1 },    // 3.5 SOL, 1 day ago
    { amount: 2000000, days_ago: 0 },    // 2 SOL, today
  ];

  let created = 0;

  for (const payment of payments) {
    try {
      const response = await fetch(`${BACKEND_URL}/payment_intents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: payment.amount,
          merchant_id: MERCHANT_ID,
        }),
      });

      if (!response.ok) {
        console.error(`❌ Failed to create payment: ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      const solAmount = (payment.amount / 1_000_000).toFixed(2);
      console.log(`✅ Created payment: ◎ ${solAmount} SOL (${payment.days_ago} days ago)`);
      created++;

      // Small delay to avoid overwhelming the backend
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Error creating payment:`, error.message);
    }
  }

  console.log(`\n✨ Seeded ${created}/${payments.length} test payments\n`);
  console.log(`📊 View dashboard at: http://localhost:8080/dashboard.html`);
  console.log(`🔑 Merchant ID: ${MERCHANT_ID}\n`);
}

seedData().catch(err => {
  console.error('Error seeding data:', err);
  process.exit(1);
});
