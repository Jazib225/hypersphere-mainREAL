/**
 * Example client integration with Tap-to-Pay backend
 * This demonstrates how a frontend or wallet app would interact with the backend
 */

import fetch from 'node-fetch';
import * as web3 from '@solana/web3.js';

const API_BASE_URL = 'http://localhost:3001';

export class TapToPayClient {
  constructor(connection, wallet) {
    this.connection = connection;
    this.wallet = wallet;
  }

  /**
   * Create a new payment intent
   */
  async createPaymentIntent(amount, merchantId) {
    const response = await fetch(`${API_BASE_URL}/payment_intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        merchant_id: merchantId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create payment intent: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get payment intent status
   */
  async getPaymentStatus(paymentIntentId) {
    const response = await fetch(
      `${API_BASE_URL}/payment_intents/${paymentIntentId}/status`
    );

    if (!response.ok) {
      throw new Error(`Failed to get payment status: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Poll for payment confirmation
   * @param {string} paymentIntentId 
   * @param {number} maxAttempts - Max polling attempts
   * @param {number} intervalMs - Polling interval in ms
   */
  async waitForPayment(paymentIntentId, maxAttempts = 120, intervalMs = 1000) {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.getPaymentStatus(paymentIntentId);

      if (status.status === 'paid') {
        console.log('✓ Payment confirmed!', status);
        return status;
      }

      if (status.status === 'failed') {
        throw new Error('Payment failed');
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    throw new Error('Payment confirmation timeout');
  }

  /**
   * Get merchant payments for dashboard
   */
  async getMerchantPayments(merchantId) {
    const response = await fetch(`${API_BASE_URL}/merchants/${merchantId}/payments`);

    if (!response.ok) {
      throw new Error(`Failed to get merchant payments: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Example payment flow
   * 1. Create payment intent
   * 2. Build transaction
   * 3. Sign and send transaction
   * 4. Wait for payment confirmation
   */
  async pay(amount, merchantId, merchantWallet) {
    try {
      // Step 1: Create payment intent on backend
      console.log(`Creating payment intent for ${amount} lamports...`);
      const paymentIntent = await this.createPaymentIntent(amount, merchantId);
      console.log('✓ Payment intent created:', paymentIntent.id);

      // Step 2: Build transaction (simplified example)
      // In real implementation, you would:
      // - Create instruction to call tap_to_pay.pay_invoice
      // - Include paymentIntentId, amount, nonce from paymentIntent
      // - Set merchant as recipient

      // Example instruction building:
      const instruction = {
        programId: new web3.PublicKey(paymentIntent.programId),
        keys: [
          // Payment intent PDA account
          // Payer account
          // Merchant account
          // System program
        ],
        data: Buffer.concat([
          Buffer.from('YOUR_DISCRIMINATOR_HERE'), // Instruction discriminator
          Buffer.from(paymentIntent.id),
          Buffer.from([amount & 0xFF, (amount >> 8) & 0xFF]), // amount
          Buffer.from(paymentIntent.nonce, 'hex'), // nonce
          Buffer.from([0]), // bump seed
        ]),
      };

      // Step 3: Sign and send (would use wallet.sendTransaction)
      // const tx = await this.wallet.sendTransaction(
      //   new web3.Transaction().add(instruction),
      //   this.connection
      // );
      // console.log('✓ Transaction sent:', tx);

      // Step 4: Wait for payment confirmation
      console.log('Waiting for payment confirmation...');
      const confirmedPayment = await this.waitForPayment(paymentIntent.id);

      console.log('✓ Payment successful!');
      console.log('  TX Signature:', confirmedPayment.tx_signature);
      console.log('  Amount:', confirmedPayment.amount);

      return confirmedPayment;
    } catch (error) {
      console.error('❌ Payment failed:', error);
      throw error;
    }
  }
}

export default TapToPayClient;
