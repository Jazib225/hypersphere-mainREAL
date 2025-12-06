import { PayoutService } from '../services/PayoutService';
import { SolanaClient } from '../clients/chain/solanaClient';
import { EvmClient } from '../clients/chain/evmClient';
import prisma from '../db/client';
import { Chain, PayoutStatus } from '@prisma/client';

// Mock dependencies
jest.mock('../clients/chain/solanaClient');
jest.mock('../clients/chain/evmClient');
jest.mock('../db/client', () => ({
  __esModule: true,
  default: {
    merchant: {
      findUnique: jest.fn(),
    },
    payout: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('PayoutService', () => {
  let payoutService: PayoutService;
  let mockSolanaClient: jest.Mocked<SolanaClient>;
  let mockEvmClient: jest.Mocked<EvmClient>;

  beforeEach(() => {
    mockSolanaClient = {
      sendUsdc: jest.fn(),
    } as any;

    mockEvmClient = {
      sendUsdc: jest.fn(),
    } as any;

    (SolanaClient as jest.Mock).mockImplementation(() => mockSolanaClient);
    (EvmClient as jest.Mock).mockImplementation(() => mockEvmClient);

    payoutService = new PayoutService();
    jest.clearAllMocks();
  });

  describe('createAndSendPayout', () => {
    it('should create and send payout on Solana', async () => {
      const mockMerchant = {
        id: 'merchant-1',
        payout_chain: Chain.SOLANA,
        payout_address: 'SolanaAddress123',
      };

      const mockPayout = {
        id: 'payout-1',
        merchant_id: 'merchant-1',
        destination_chain: Chain.SOLANA,
        destination_address: 'SolanaAddress123',
        amount_usdc: { toNumber: () => 100 },
        status: PayoutStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockUpdatedPayout = {
        ...mockPayout,
        tx_hash: 'solana-tx-123',
        status: PayoutStatus.SENT,
      };

      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (prisma.payout.create as jest.Mock).mockResolvedValue(mockPayout);
      (prisma.payout.update as jest.Mock).mockResolvedValue(mockUpdatedPayout);
      (mockSolanaClient.sendUsdc as jest.Mock).mockResolvedValue('solana-tx-123');

      const { Decimal } = await import('@prisma/client/runtime/library');
      const result = await payoutService.createAndSendPayout(
        'merchant-1',
        Chain.SOLANA,
        new Decimal(100)
      );

      expect(mockSolanaClient.sendUsdc).toHaveBeenCalledWith('SolanaAddress123', 100);
      expect(result.tx_hash).toBe('solana-tx-123');
      expect(result.status).toBe(PayoutStatus.SENT);
    });

    it('should create and send payout on Ethereum', async () => {
      const mockMerchant = {
        id: 'merchant-1',
        payout_chain: Chain.ETHEREUM,
        payout_address: '0xEthereumAddress',
      };

      const mockPayout = {
        id: 'payout-1',
        merchant_id: 'merchant-1',
        destination_chain: Chain.ETHEREUM,
        destination_address: '0xEthereumAddress',
        amount_usdc: { toNumber: () => 100 },
        status: PayoutStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockUpdatedPayout = {
        ...mockPayout,
        tx_hash: '0xeth-tx-123',
        status: PayoutStatus.SENT,
      };

      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (prisma.payout.create as jest.Mock).mockResolvedValue(mockPayout);
      (prisma.payout.update as jest.Mock).mockResolvedValue(mockUpdatedPayout);
      (mockEvmClient.sendUsdc as jest.Mock).mockResolvedValue('0xeth-tx-123');

      const { Decimal } = await import('@prisma/client/runtime/library');
      const result = await payoutService.createAndSendPayout(
        'merchant-1',
        Chain.ETHEREUM,
        new Decimal(100)
      );

      expect(mockEvmClient.sendUsdc).toHaveBeenCalledWith(
        Chain.ETHEREUM,
        '0xEthereumAddress',
        100
      );
      expect(result.tx_hash).toBe('0xeth-tx-123');
      expect(result.status).toBe(PayoutStatus.SENT);
    });

    it('should mark payout as failed if send fails', async () => {
      const mockMerchant = {
        id: 'merchant-1',
        payout_chain: Chain.SOLANA,
        payout_address: 'SolanaAddress123',
      };

      const mockPayout = {
        id: 'payout-1',
        status: PayoutStatus.PENDING,
      };

      (prisma.merchant.findUnique as jest.Mock).mockResolvedValue(mockMerchant);
      (prisma.payout.create as jest.Mock).mockResolvedValue(mockPayout);
      (mockSolanaClient.sendUsdc as jest.Mock).mockRejectedValue(new Error('Send failed'));
      (prisma.payout.update as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: PayoutStatus.FAILED,
      });

      const { Decimal } = await import('@prisma/client/runtime/library');
      await expect(
        payoutService.createAndSendPayout('merchant-1', Chain.SOLANA, new Decimal(100))
      ).rejects.toThrow('Send failed');

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout-1' },
        data: { status: PayoutStatus.FAILED },
      });
    });
  });
});

