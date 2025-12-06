import { BridgeService } from '../services/BridgeService';
import { BridgeKitClient } from '../clients/circle/BridgeKitClient';
import { PayoutService } from '../services/PayoutService';
import prisma from '../db/client';
import { Chain, PaymentStatus, TransferStatus } from '@prisma/client';

// Mock dependencies
jest.mock('../clients/circle/BridgeKitClient');
jest.mock('../services/PayoutService');
jest.mock('../db/client', () => ({
  __esModule: true,
  default: {
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transfer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('BridgeService', () => {
  let bridgeService: BridgeService;
  let mockBridgeKitClient: jest.Mocked<BridgeKitClient>;
  let mockPayoutService: jest.Mocked<PayoutService>;

  beforeEach(() => {
    mockBridgeKitClient = {
      burnUsdcOnChain: jest.fn(),
      getAttestation: jest.fn(),
      mintUsdcOnChain: jest.fn(),
    } as any;

    mockPayoutService = {
      createAndSendPayout: jest.fn(),
    } as any;

    (BridgeKitClient as jest.Mock).mockImplementation(() => mockBridgeKitClient);
    (PayoutService as jest.Mock).mockImplementation(() => mockPayoutService);

    bridgeService = new BridgeService();
    jest.clearAllMocks();
  });

  describe('startBridgeForPayment', () => {
    it('should start bridge process and return burn tx hash', async () => {
      const mockPayment = {
        id: 'payment-1',
        source_chain: Chain.ETHEREUM,
        amount_usdc: { toNumber: () => 100 },
        custodial_source_address: '0xcustodial',
        merchant: {
          payout_chain: Chain.SOLANA,
        },
        transfers: [
          {
            id: 'transfer-1',
            status: TransferStatus.PENDING_BURN,
          },
        ],
      };

      const mockUpdatedTransfer = {
        id: 'transfer-1',
        burn_tx_hash: '0xburn123',
        status: TransferStatus.PENDING_ATTESTATION,
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.transfer.update as jest.Mock).mockResolvedValue(mockUpdatedTransfer);
      (prisma.payment.update as jest.Mock).mockResolvedValue(mockPayment);
      (mockBridgeKitClient.burnUsdcOnChain as jest.Mock).mockResolvedValue('0xburn123');

      const result = await bridgeService.startBridgeForPayment('payment-1');

      expect(mockBridgeKitClient.burnUsdcOnChain).toHaveBeenCalledWith(
        Chain.ETHEREUM,
        100,
        '0xcustodial'
      );
      expect(result.transfer).toBeDefined();
      expect(result.transfer!.burn_tx_hash).toBe('0xburn123');
      expect(result.transfer!.status).toBe(TransferStatus.PENDING_ATTESTATION);
    });

    it('should return early if no bridge needed', async () => {
      const mockPayment = {
        id: 'payment-1',
        source_chain: Chain.ETHEREUM,
        merchant: {
          payout_chain: Chain.ETHEREUM,
        },
        transfers: [],
      };

      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.SETTLED,
      });

      const result = await bridgeService.startBridgeForPayment('payment-1');

      expect(mockBridgeKitClient.burnUsdcOnChain).not.toHaveBeenCalled();
      expect(result.message).toBe('No bridge needed - same chain');
    });
  });

  describe('pollAttestationAndMint', () => {
    it('should complete mint and create payout', async () => {
      const mockTransfer = {
        id: 'transfer-1',
        burn_tx_hash: '0xburn123',
        payment_id: 'payment-1',
        mint_chain: Chain.SOLANA,
        payment: {
          merchant_id: 'merchant-1',
          amount_usdc: { toNumber: () => 100 },
          custodial_source_address: '0xcustodial',
        },
      };

      const mockUpdatedTransferWithAttestation = {
        ...mockTransfer,
        attestation_id: 'attestation-123',
        status: TransferStatus.PENDING_MINT,
      };

      const mockFinalTransfer = {
        id: 'transfer-1',
        burn_tx_hash: '0xburn123',
        payment_id: 'payment-1',
        mint_chain: Chain.SOLANA,
        attestation_id: 'attestation-123',
        mint_tx_hash: '0xmint123',
        status: TransferStatus.COMPLETED,
        created_at: new Date(),
        updated_at: new Date(),
        payment: {
          merchant_id: 'merchant-1',
          amount_usdc: { toNumber: () => 100 },
          custodial_source_address: '0xcustodial',
        },
      };

      const mockFinalPayment = {
        id: 'payment-1',
        status: PaymentStatus.SETTLED,
      };

      // First call returns original transfer
      (prisma.transfer.findUnique as jest.Mock).mockResolvedValueOnce(mockTransfer);
      
      // After updates, return the final transfer
      (prisma.transfer.update as jest.Mock)
        .mockResolvedValueOnce(mockUpdatedTransferWithAttestation) // After attestation update
        .mockResolvedValueOnce(mockFinalTransfer); // After mint update

      // Final findUnique call returns the completed transfer
      (prisma.transfer.findUnique as jest.Mock).mockResolvedValueOnce(mockFinalTransfer);

      (prisma.payment.update as jest.Mock).mockResolvedValue(mockFinalPayment);
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockFinalPayment);
      (mockBridgeKitClient.getAttestation as jest.Mock).mockResolvedValue('attestation-123');
      (mockBridgeKitClient.mintUsdcOnChain as jest.Mock).mockResolvedValue('0xmint123');
      (mockPayoutService.createAndSendPayout as jest.Mock).mockResolvedValue({});

      const result = await bridgeService.pollAttestationAndMint('transfer-1');

      expect(mockBridgeKitClient.getAttestation).toHaveBeenCalledWith('0xburn123');
      expect(mockBridgeKitClient.mintUsdcOnChain).toHaveBeenCalledWith(
        Chain.SOLANA,
        'attestation-123',
        '0xcustodial'
      );
      expect(mockPayoutService.createAndSendPayout).toHaveBeenCalled();
      expect(result.transfer).toBeDefined();
      expect(result.transfer!.status).toBe(TransferStatus.COMPLETED);
    });
  });
});

