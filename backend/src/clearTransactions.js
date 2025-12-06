// Utility script to clear all transactions (for testing)
// Run: node src/clearTransactions.js

import { clearAllTransactions, getAllTransactions } from './transactionStore.js';

const count = getAllTransactions().length;
clearAllTransactions();
console.log(`Cleared ${count} transactions from store`);

