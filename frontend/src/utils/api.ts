// API utility for backend communication

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Payment {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  tx_signature: string | null;
  merchant_id?: string;
  currency?: string;
  tip_amount?: number;
  chain?: string;
}

export interface MerchantPaymentsResponse {
  merchant_id: string;
  total_count: number;
  payments: Payment[];
}

/**
 * Fetch all payments for a merchant
 */
export async function fetchMerchantPayments(merchantId: string): Promise<MerchantPaymentsResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/merchants/${merchantId}/payments`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching merchant payments:', error);
    throw error;
  }
}

/**
 * Get payment intent status
 */
export async function getPaymentStatus(paymentIntentId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/payment_intents/${paymentIntentId}/status`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching payment status:', error);
    throw error;
  }
}


/**
 * Format transaction signature for display
 */
export function formatTxSignature(signature: string | null): string {
  if (!signature) return 'N/A';
  if (signature.length <= 8) return signature;
  return `${signature.substring(0, 4)}...${signature.substring(signature.length - 4)}`;
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format date/time for display
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(',', '');
}

/**
 * Get blockchain explorer URL for a transaction
 */
export function getExplorerUrl(chain: string, txSignature: string | null): string {
  if (!txSignature) {
    return '#';
  }
  
  const chainUpper = chain?.toUpperCase() || 'SOL';
  
  if (chainUpper === 'SOL' || chainUpper === 'SOLANA') {
    return `https://solscan.io/tx/${txSignature}`;
  } else if (chainUpper === 'ETH' || chainUpper === 'ETHEREUM') {
    return `https://etherscan.io/tx/${txSignature}`;
  } else if (chainUpper === 'BASE') {
    return `https://basescan.org/tx/${txSignature}`;
  }
  
  // Default to Solana
  return `https://solscan.io/tx/${txSignature}`;
}

