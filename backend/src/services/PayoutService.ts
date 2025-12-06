import prisma from '../db/client';
import { Chain, PayoutStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SolanaClient } from '../clients/chain/solanaClient';
import { EvmClient } from '../clients/chain/evmClient';

export class PayoutService {
  private solanaClient: SolanaClient;
  private evmClient: EvmClient;

  constructor() {
    this.solanaClient = new SolanaClient();
    this.evmClient = new EvmClient();
  }

  /**
   * Create and send payout to merchant
   */
  async createAndSendPayout(
    merchantId: string,
    destinationChain: Chain,
    amountUsdc: Decimal
  ) {
    // Get merchant
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new Error(`Merchant not found: ${merchantId}`);
    }

    // Verify payout chain matches merchant preference
    if (merchant.payout_chain !== destinationChain) {
      throw new Error(
        `Payout chain ${destinationChain} does not match merchant preference ${merchant.payout_chain}`
      );
    }

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        merchant_id: merchantId,
        destination_chain: destinationChain,
        destination_address: merchant.payout_address,
        amount_usdc: amountUsdc,
        status: PayoutStatus.PENDING,
      },
    });

    try {
      // Send USDC to merchant
      let txHash: string;

      if (destinationChain === Chain.SOLANA) {
        txHash = await this.solanaClient.sendUsdc(
          merchant.payout_address,
          amountUsdc.toNumber()
        );
      } else {
        // EVM chain (Ethereum or Base)
        txHash = await this.evmClient.sendUsdc(
          destinationChain,
          merchant.payout_address,
          amountUsdc.toNumber()
        );
      }

      // Update payout with transaction hash
      const updated = await prisma.payout.update({
        where: { id: payout.id },
        data: {
          tx_hash: txHash,
          status: PayoutStatus.SENT,
        },
      });

      return updated;
    } catch (error) {
      // Mark payout as failed
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: PayoutStatus.FAILED },
      });

      throw error;
    }
  }

  /**
   * Get payouts for a merchant
   */
  async getMerchantPayouts(merchantId: string) {
    return prisma.payout.findMany({
      where: { merchant_id: merchantId },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get payout by ID
   */
  async getPayoutById(payoutId: string) {
    return prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        merchant: true,
      },
    });
  }
}

