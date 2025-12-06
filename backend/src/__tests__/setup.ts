// Jest setup file - runs before all tests
// This file is NOT a test file, it's a setup file

// Set NODE_ENV to test to avoid config validation errors
process.env.NODE_ENV = 'test';

// Set minimal required env vars for tests
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || 'test-circle-api-key';
process.env.CUSTODIAL_SOLANA_KEY = process.env.CUSTODIAL_SOLANA_KEY || 'test-solana-key-hex';
process.env.CUSTODIAL_ETH_KEY = process.env.CUSTODIAL_ETH_KEY || 'test-eth-key-hex';
process.env.CUSTODIAL_BASE_KEY = process.env.CUSTODIAL_BASE_KEY || 'test-base-key-hex';
