import { PaymentService } from '../services/PaymentService';
import prisma from '../db/client';
import { Chain, PaymentStatus, TransferStatus } from '@prisma/client';

// Mock Prisma
jest.mock('../db/client', () => ({
  __esModule: true,
  default: {
    merchant: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transfer: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    paymentService = new PaymentService();
    jest.clearAllMocks();
  });

  describe('registerIncomingPayment', () => {
    it('should register payment and create transfer when bridge is needed', async () => {
      const mockMerchant = {
        id: 'merchant-1',
        payout_chain: Chain.SOLANA,
      };

      const mockPayment = {
        id: 'payment-1',
        merchant_id: 'merchant-1',
        source_chain: Chain.ETHEREUM,
        source_tx_hash: '0x123',
        amount_usdc: { toNumber: () => 100 },
        status: PaymentStatus.RECEIVED,
        custodial_source_address: '0xcustodial',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockTransfer = {
        id: 'transfer-1',
        payment_id: 'payment-1',
        burn_chain: Chain.ETHEREUM,
        mint_chain: Chain.SOLANA,
        status: TransferStatus.PENDING_BURN,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          payment: {
            create: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn(),
          },
          transfer: {
            create: jest.fn().mockResolvedValue(mockTransfer),
          },
        });
      });

      const result = await paymentService.registerIncomingPayment({
        merchantId: 'merchant-1',
        sourceChain: Chain.ETHEREUM,
        sourceTxHash: '0x123',
        amountUsdc: 100,
        custodialSourceAddress: '0xcustodial',
      });

      expect(result.payment).toBeDefined();
      expect(result.transfer).toBeDefined();
      expect(result.transfer.status).toBe(TransferStatus.PENDING_BURN);
    });

    it('should mark payment as settled when no bridge is needed', async () => {
      const mockMerchant = {
        id: 'merchant-1',
        payout_chain: Chain.ETHEREUM,
      };

      const mockPayment = {
        id: 'payment-1',
        merchant_id: 'merchant-1',
        source_chain: Chain.ETHEREUM,
        source_tx_hash: '0x123',
        amount_usdc: { toNumber: () => 100 },
        status: PaymentStatus.SETTLED,
        custodial_source_address: '0xcustodial',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockTransfer = {
        id: 'transfer-1',
        payment_id: 'payment-1',
        burn_chain: Chain.ETHEREUM,
        mint_chain: Chain.ETHEREUM,
        status: TransferStatus.COMPLETED,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          payment: {
            create: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn(),
          },
          transfer: {
            create: jest.fn().mockResolvedValue(mockTransfer),
          },
        };
        await callback(tx);
        return { payment: mockPayment, transfer: mockTransfer };
      });

      const result = await paymentService.registerIncomingPayment({
        merchantId: 'merchant-1',
        sourceChain: Chain.ETHEREUM,
        sourceTxHash: '0x123',
        amountUsdc: 100,
        custodialSourceAddress: '0xcustodial',
      });

      expect(result.payment.status).toBe(PaymentStatus.SETTLED);
      expect(result.transfer.status).toBe(TransferStatus.COMPLETED);
    });

    it('should throw error if merchant not found', async () => {
      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        paymentService.registerIncomingPayment({
          merchantId: 'invalid',
          sourceChain: Chain.ETHEREUM,
          sourceTxHash: '0x123',
          amountUsdc: 100,
          custodialSourceAddress: '0xcustodial',
        })
      ).rejects.toThrow('Merchant not found');
    });
  });
});

