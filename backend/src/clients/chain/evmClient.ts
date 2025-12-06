import { ethers } from 'ethers';
import { Chain } from '@prisma/client';
import config, { CHAIN_CONFIG } from '../../config';

/**
 * EVM Client for Ethereum and Base chains
 * 
 * TODO: Wire up actual EVM RPC and signing
 */
export class EvmClient {
  private providers: Map<Chain, ethers.JsonRpcProvider>;
  private signers: Map<Chain, ethers.Wallet>;

  constructor() {
    this.providers = new Map();
    this.signers = new Map();

    // Initialize providers and signers for each EVM chain
    for (const [chainName, chainConfig] of Object.entries(CHAIN_CONFIG)) {
      if (chainName === 'ETHEREUM' || chainName === 'BASE') {
        const chain = chainName as Chain;
        const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
        this.providers.set(chain, provider);

        // Create wallet from private key
        // TODO: In production, use secure key management
        const wallet = new ethers.Wallet(chainConfig.custodialKey, provider);
        this.signers.set(chain, wallet);
      }
    }
  }

  /**
   * Send USDC to a recipient address on an EVM chain
   * 
   * @param chain Chain (ETHEREUM or BASE)
   * @param toAddress Recipient address
   * @param amountUsdc Amount in USDC (will be converted to smallest units)
   * @returns Transaction hash
   */
  async sendUsdc(
    chain: Chain,
    toAddress: string,
    amountUsdc: number
  ): Promise<string> {
    if (chain !== Chain.ETHEREUM && chain !== Chain.BASE) {
      throw new Error(`EVM client does not support chain: ${chain}`);
    }

    const provider = this.providers.get(chain);
    const signer = this.signers.get(chain);

    if (!provider || !signer) {
      throw new Error(`Provider or signer not initialized for chain: ${chain}`);
    }

    const chainConfig = CHAIN_CONFIG[chain];
    const usdcContractAddress = chainConfig.usdcContract;

    // Convert amount to smallest units (USDC has 6 decimals)
    const amountInSmallestUnits = ethers.parseUnits(
      amountUsdc.toFixed(6),
      6
    );

    // Stub implementation for testing
    if (process.env.NODE_ENV === 'test') {
      return `0x${Buffer.from(`${chain}-tx-${Date.now()}`).toString('hex').slice(0, 64)}`;
    }

    try {
      // ERC-20 transfer function signature: transfer(address,uint256)
      const transferAbi = [
        'function transfer(address to, uint256 amount) returns (bool)',
      ];

      const usdcContract = new ethers.Contract(
        usdcContractAddress,
        transferAbi,
        signer
      );

      // Send transaction
      const tx = await usdcContract.transfer(toAddress, amountInSmallestUnits);
      const receipt = await tx.wait();

      return receipt.hash;
    } catch (error) {
      throw new Error(
        `Failed to send USDC on ${chain}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get USDC balance for an address
   */
  async getUsdcBalance(chain: Chain, address: string): Promise<number> {
    if (chain !== Chain.ETHEREUM && chain !== Chain.BASE) {
      throw new Error(`EVM client does not support chain: ${chain}`);
    }

    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Provider not initialized for chain: ${chain}`);
    }

    const chainConfig = CHAIN_CONFIG[chain];
    const usdcContractAddress = chainConfig.usdcContract;

    try {
      // ERC-20 balanceOf function
      const balanceOfAbi = ['function balanceOf(address owner) view returns (uint256)'];

      const usdcContract = new ethers.Contract(
        usdcContractAddress,
        balanceOfAbi,
        provider
      );

      const balance = await usdcContract.balanceOf(address);
      return parseFloat(ethers.formatUnits(balance, 6));
    } catch (error) {
      throw new Error(
        `Failed to get USDC balance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

