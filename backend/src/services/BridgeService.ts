import prisma from '../db/client';
import { Chain, PaymentStatus, TransferStatus } from '@prisma/client';
import { BridgeKitClient } from '../clients/circle/BridgeKitClient';
import { PayoutService } from './PayoutService';

export class BridgeService {
  private bridgeKitClient: BridgeKitClient;
  private payoutService: PayoutService;

  constructor() {
    this.bridgeKitClient = new BridgeKitClient();
    this.payoutService = new PayoutService();
  }

  /**
   * Start bridge process for a payment
   */
  async startBridgeForPayment(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        merchant: true,
        transfers: {
          where: {
            status: {
              in: [
                TransferStatus.PENDING_BURN,
                TransferStatus.PENDING_ATTESTATION,
                TransferStatus.PENDING_MINT,
              ],
            },
          },
        },
      },
    });

    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    // If source chain == payout chain, no bridge needed
    if (payment.source_chain === payment.merchant.payout_chain) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.SETTLED },
      });
      return { payment, message: 'No bridge needed - same chain' };
    }

    // Get the active transfer
    const transfer = payment.transfers[0];
    if (!transfer) {
      throw new Error(`No active transfer found for payment: ${paymentId}`);
    }

    // If already in progress, return current state
    if (transfer.status === TransferStatus.PENDING_ATTESTATION) {
      return { payment, transfer, message: 'Bridge already in progress' };
    }

    if (transfer.status === TransferStatus.PENDING_MINT) {
      return { payment, transfer, message: 'Waiting for mint' };
    }

    // Start burn process
    try {
      const burnTxHash = await this.bridgeKitClient.burnUsdcOnChain(
        payment.source_chain,
        payment.amount_usdc.toNumber(),
        payment.custodial_source_address
      );

      // Update transfer with burn tx hash
      const updatedTransfer = await prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          burn_tx_hash: burnTxHash,
          status: TransferStatus.PENDING_ATTESTATION,
        },
      });

      // Update payment status
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.BRIDGE_IN_PROGRESS },
      });

      const updatedPayment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      return {
        payment: updatedPayment!,
        transfer: updatedTransfer,
      };
    } catch (error) {
      // Mark transfer as failed
      await prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: TransferStatus.FAILED },
      });

      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.BRIDGE_FAILED },
      });

      throw error;
    }
  }

  /**
   * Poll for attestation and complete mint
   */
  async pollAttestationAndMint(transferId: string) {
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      include: {
        payment: {
          include: {
            merchant: true,
          },
        },
      },
    });

    if (!transfer) {
      throw new Error(`Transfer not found: ${transferId}`);
    }

    if (!transfer.burn_tx_hash) {
      throw new Error('Burn transaction hash not found');
    }

    // Get attestation from Circle
    let attestationId: string;
    try {
      attestationId = await this.bridgeKitClient.getAttestation(
        transfer.burn_tx_hash
      );
    } catch (error) {
      // Attestation might not be ready yet
      throw new Error(
        `Attestation not ready yet for burn tx: ${transfer.burn_tx_hash}`
      );
    }

    // Update transfer with attestation ID
    await prisma.transfer.update({
      where: { id: transferId },
      data: {
        attestation_id: attestationId,
        status: TransferStatus.PENDING_MINT,
      },
    });

    // Perform mint on destination chain
    try {
      const mintTxHash = await this.bridgeKitClient.mintUsdcOnChain(
        transfer.mint_chain,
        attestationId,
        transfer.payment.custodial_source_address // Will be custodial address on mint chain
      );

      // Update transfer as completed
      await prisma.transfer.update({
        where: { id: transferId },
        data: {
          mint_tx_hash: mintTxHash,
          status: TransferStatus.COMPLETED,
        },
      });

      // Update payment as settled
      await prisma.payment.update({
        where: { id: transfer.payment_id },
        data: { status: PaymentStatus.SETTLED },
      });

      // Create payout to merchant
      await this.payoutService.createAndSendPayout(
        transfer.payment.merchant_id,
        transfer.mint_chain,
        transfer.payment.amount_usdc
      );

      const finalTransfer = await prisma.transfer.findUnique({
        where: { id: transferId },
      });

      const finalPayment = await prisma.payment.findUnique({
        where: { id: transfer.payment_id },
      });

      return {
        transfer: finalTransfer!,
        payment: finalPayment!,
      };
    } catch (error) {
      // Mark transfer as failed
      await prisma.transfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.FAILED },
      });

      await prisma.payment.update({
        where: { id: transfer.payment_id },
        data: { status: PaymentStatus.BRIDGE_FAILED },
      });

      throw error;
    }
  }
}

