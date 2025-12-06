import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Server
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Circle API
  CIRCLE_API_KEY: z.string().min(1, 'CIRCLE_API_KEY is required'),
  CIRCLE_API_SECRET: z.string().optional(),

  // Custodial Wallets (private keys - never log these)
  CUSTODIAL_SOLANA_KEY: z.string().min(1, 'CUSTODIAL_SOLANA_KEY is required'),
  CUSTODIAL_ETH_KEY: z.string().min(1, 'CUSTODIAL_ETH_KEY is required'),
  CUSTODIAL_BASE_KEY: z.string().min(1, 'CUSTODIAL_BASE_KEY is required'),

  // RPC Endpoints
  SOLANA_RPC_URL: z.string().url().default('https://api.mainnet-beta.solana.com'),
  ETHEREUM_RPC_URL: z.string().url().default('https://eth.llamarpc.com'),
  BASE_RPC_URL: z.string().url().default('https://mainnet.base.org'),

  // USDC Contract Addresses
  USDC_ETHEREUM: z.string().default('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  USDC_BASE: z.string().default('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  USDC_SOLANA_MINT: z.string().default('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),

  // Circle CCTP Domain IDs
  CCTP_DOMAIN_ETHEREUM: z.string().default('0'),
  CCTP_DOMAIN_BASE: z.string().default('6'),
  CCTP_DOMAIN_SOLANA: z.string().default('1'),
});

export type Config = z.infer<typeof configSchema>;

let config: Config;

try {
  config = configSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    // In test environment, use defaults instead of exiting
    if (process.env.NODE_ENV === 'test') {
      config = configSchema.parse({
        PORT: '3001',
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        CIRCLE_API_KEY: 'test-key',
        CUSTODIAL_SOLANA_KEY: 'test-solana-key',
        CUSTODIAL_ETH_KEY: 'test-eth-key',
        CUSTODIAL_BASE_KEY: 'test-base-key',
        ...process.env,
      });
    } else {
      console.error('❌ Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
  } else {
    throw error;
  }
}

// Chain configuration
export const CHAIN_CONFIG = {
  SOLANA: {
    chainId: 'solana',
    domain: config.CCTP_DOMAIN_SOLANA,
    rpcUrl: config.SOLANA_RPC_URL,
    usdcContract: config.USDC_SOLANA_MINT,
    custodialKey: config.CUSTODIAL_SOLANA_KEY,
  },
  ETHEREUM: {
    chainId: '1',
    domain: config.CCTP_DOMAIN_ETHEREUM,
    rpcUrl: config.ETHEREUM_RPC_URL,
    usdcContract: config.USDC_ETHEREUM,
    custodialKey: config.CUSTODIAL_ETH_KEY,
  },
  BASE: {
    chainId: '8453',
    domain: config.CCTP_DOMAIN_BASE,
    rpcUrl: config.BASE_RPC_URL,
    usdcContract: config.USDC_BASE,
    custodialKey: config.CUSTODIAL_BASE_KEY,
  },
} as const;

export default config;

