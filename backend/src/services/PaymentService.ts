import prisma from '../db/client';
import { Chain, PaymentStatus, TransferStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface IncomingPaymentInput {
  merchantId: string;
  sourceChain: Chain;
  sourceTxHash: string;
  amountUsdc: string | number | Decimal;
  custodialSourceAddress: string;
}

export interface PaymentWithTransfer {
  payment: {
    id: string;
    merchant_id: string;
    source_chain: Chain;
    source_tx_hash: string;
    amount_usdc: Decimal;
    status: PaymentStatus;
    custodial_source_address: string;
    created_at: Date;
    updated_at: Date;
  };
  transfer: {
    id: string;
    payment_id: string;
    burn_chain: Chain;
    burn_tx_hash: string | null;
    attestation_id: string | null;
    mint_chain: Chain;
    mint_tx_hash: string | null;
    status: TransferStatus;
    created_at: Date;
    updated_at: Date;
  };
}

export class PaymentService {
  /**
   * Register an incoming payment that was received on a custodial address
   */
  async registerIncomingPayment(
    input: IncomingPaymentInput
  ): Promise<PaymentWithTransfer> {
    // Validate merchant exists
    const merchant = await prisma.merchant.findUnique({
      where: { id: input.merchantId },
    });

    if (!merchant) {
      throw new Error(`Merchant not found: ${input.merchantId}`);
    }

    // Check if payment with this tx hash already exists
    const existing = await prisma.payment.findUnique({
      where: { source_tx_hash: input.sourceTxHash },
    });

    if (existing) {
      const transfer = await prisma.transfer.findFirst({
        where: { payment_id: existing.id },
      });
      return {
        payment: existing,
        transfer: transfer!,
      };
    }

    // Convert amount to Decimal
    const amountUsdc = new Decimal(input.amountUsdc);

    // Create payment and transfer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.payment.create({
        data: {
          merchant_id: input.merchantId,
          source_chain: input.sourceChain,
          source_tx_hash: input.sourceTxHash,
          amount_usdc: amountUsdc,
          status: PaymentStatus.RECEIVED,
          custodial_source_address: input.custodialSourceAddress,
        },
      });

      // Determine if bridging is needed
      const needsBridge = merchant.payout_chain !== input.sourceChain;

      // Create transfer record
      const transfer = await tx.transfer.create({
        data: {
          payment_id: payment.id,
          burn_chain: input.sourceChain,
          mint_chain: merchant.payout_chain,
          status: needsBridge
            ? TransferStatus.PENDING_BURN
            : TransferStatus.COMPLETED, // No bridge needed
        },
      });

      // If no bridge needed, mark payment as settled
      if (!needsBridge) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.SETTLED },
        });
      }

      return { payment, transfer };
    });

    return result;
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        merchant: true,
        transfers: true,
      },
    });
  }

  /**
   * Get payment by transaction hash
   */
  async getPaymentByTxHash(txHash: string) {
    return prisma.payment.findUnique({
      where: { source_tx_hash: txHash },
      include: {
        merchant: true,
        transfers: true,
      },
    });
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus
  ) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: { status },
    });
  }
}

