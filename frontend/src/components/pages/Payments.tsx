import { useState, useEffect } from "react";
import { fetchMerchantPayments, formatAmount, formatDateTime, formatTxSignature, getExplorerUrl, type Payment } from "../../utils/api";

// Merchant ID - update this with your actual merchant wallet address
const MERCHANT_ID = "4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U";

// Maximum number of transactions to show in the table
const MAX_TABLE_TRANSACTIONS = 20;

export function Payments() {
  // Keep ALL payments for graphs/analytics
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  // Only show MAX_TABLE_TRANSACTIONS in the table (newest at top)
  const [tablePayments, setTablePayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chainFilter, setChainFilter] = useState<string>("All");
  const [dateRange, setDateRange] = useState<string>("Today");
  const [tipFilter, setTipFilter] = useState<string>("All");
  const [amountRange, setAmountRange] = useState<string>("All");
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);

  // Fetch payments from backend
  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true);
        const data = await fetchMerchantPayments(MERCHANT_ID);
        const newPayments = data.payments || [];
        
        // Update all payments (for graphs - keeps all transactions)
        setAllPayments(newPayments);
        
        // Check if there's a new transaction (by comparing latest ID)
        const latestTransactionId = newPayments.length > 0 ? newPayments[0]?.id : null;
        const hasNewTransaction = latestTransactionId && latestTransactionId !== lastTransactionId;
        
        // Initial load or new transaction detected
        if (lastTransactionId === null && newPayments.length > 0) {
          // Initial load: populate table with latest transactions
          const initialTable = newPayments.slice(0, MAX_TABLE_TRANSACTIONS);
          setTablePayments(initialTable);
          setLastTransactionId(newPayments[0]?.id || null);
          console.log(`📊 Initial load: ${initialTable.length} transactions in table`);
        } else if (hasNewTransaction && latestTransactionId) {
          console.log(`🆕 NEW TRANSACTION DETECTED!`);
          console.log(`   ID: ${latestTransactionId}`);
          console.log(`   Amount: $${newPayments[0]?.amount} ${newPayments[0]?.chain}`);
          console.log(`   Tip: $${newPayments[0]?.tip_amount || 0}`);
          console.log(`   Time: ${newPayments[0]?.created_at}`);
          
          // Update table: add new transaction to top, remove bottom if exceeds max
          setTablePayments(prev => {
            // Add new transaction to the top
            const updated = [newPayments[0], ...prev];
            
            // Remove duplicates (in case same transaction appears twice)
            const unique = updated.filter((tx, index, self) => 
              index === self.findIndex(t => t.id === tx.id)
            );
            
            // Keep only MAX_TABLE_TRANSACTIONS (remove bottom ones)
            const limited = unique.slice(0, MAX_TABLE_TRANSACTIONS);
            
            const wasAtMax = prev.length >= MAX_TABLE_TRANSACTIONS;
            console.log(`   ✅ Added to table (${limited.length}/${MAX_TABLE_TRANSACTIONS})`);
            if (wasAtMax) {
              console.log(`   🗑️ Removed oldest transaction from table (still in graphs)`);
            }
            
            return limited;
          });
          
          setLastTransactionId(latestTransactionId);
        }
        
        setError(null);
      } catch (err) {
        console.error("Failed to load payments:", err);
        setError("Failed to load payments. Please check if the backend is running.");
      } finally {
        setLoading(false);
      }
    }

    // Load immediately
    loadPayments();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadPayments, 10000);
    return () => clearInterval(interval);
  }, [lastTransactionId]); // Only depend on lastTransactionId to avoid infinite loops

  // Transform table payments to display format (only show tablePayments, not allPayments)
  const displayPayments = tablePayments.map((payment) => ({
    id: payment.id,
    time: formatDateTime(payment.created_at),
    amount: formatAmount(payment.amount),
    rawAmount: payment.amount, // Store raw amount for filtering
    chain: payment.chain || (payment.currency === "USDC" ? "SOL" : payment.currency || "SOL"),
    tip: formatAmount(payment.tip_amount || 0),
    signature: formatTxSignature(payment.tx_signature),
    status: "Confirmed", // All payments are confirmed
    tx_signature: payment.tx_signature,
  }));

  const filteredPayments = displayPayments.filter((payment) => {
    // Chain filtering - compare normalized values
    if (chainFilter !== "All") {
      const paymentChain = (payment.chain || "").toUpperCase();
      const filterChain = chainFilter.toUpperCase();
      if (paymentChain !== filterChain) return false;
    }
    if (tipFilter === "With Tip" && parseFloat(payment.tip.replace(/,/g, '')) === 0) return false;
    if (tipFilter === "No Tip" && parseFloat(payment.tip.replace(/,/g, '')) > 0) return false;
    
    // Amount range filtering - use raw amount value
    if (amountRange !== "All") {
      const amount = payment.rawAmount; // Use raw amount value
      switch (amountRange) {
        case "$0 - $500":
          if (amount < 0 || amount > 500) return false;
          break;
        case "$500 - $1,000":
          if (amount < 500 || amount > 1000) return false;
          break;
        case "$1,000 - $5,000":
          if (amount < 1000 || amount > 5000) return false;
          break;
        case "$5,000+":
          if (amount < 5000) return false;
          break;
      }
    }
    
    // Date filtering can be enhanced later
    return true;
  });

  // Export payments to CSV
  const exportToCSV = () => {
    if (filteredPayments.length === 0) {
      alert("No payments to export");
      return;
    }

    // CSV headers
    const headers = ["ID", "Time", "Amount (USDC)", "Chain", "Tip", "Transaction Signature", "Status"];
    
    // CSV rows
    const rows = filteredPayments.map(payment => [
      payment.id,
      payment.time,
      payment.amount,
      payment.chain,
      payment.tip,
      payment.signature,
      payment.status
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `payments_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#A5B6C8]">Loading payments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-400 mb-2">{error}</div>
          <div className="text-[#A5B6C8] text-sm">
            Make sure the backend server is running on http://localhost:3001
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-[#A5B6C8] mb-2">Date Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
            >
              <option>Today</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>All Time</option>
            </select>
          </div>

          <div>
            <label className="block text-[#A5B6C8] mb-2">Chain</label>
            <select
              value={chainFilter}
              onChange={(e) => setChainFilter(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
            >
              <option>All</option>
              <option>SOL</option>
              <option>BASE</option>
              <option>ETH</option>
            </select>
          </div>

          <div>
            <label className="block text-[#A5B6C8] mb-2">Tip</label>
            <select
              value={tipFilter}
              onChange={(e) => setTipFilter(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
            >
              <option>All</option>
              <option>With Tip</option>
              <option>No Tip</option>
            </select>
          </div>

          <div>
            <label className="block text-[#A5B6C8] mb-2">Amount Range</label>
            <select
              value={amountRange}
              onChange={(e) => setAmountRange(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
            >
              <option>All</option>
              <option>$0 - $500</option>
              <option>$500 - $1,000</option>
              <option>$1,000 - $5,000</option>
              <option>$5,000+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="text-[#A5B6C8]">
          Showing {filteredPayments.length} confirmed payment{filteredPayments.length !== 1 ? "s" : ""}
        </div>
        <button 
          onClick={exportToCSV}
          className="px-4 py-2 bg-[#00E7FF]/10 text-[#00E7FF] rounded-lg hover:bg-[#00E7FF]/20 transition-colors"
        >
          Export Data
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-[#121417] border border-[#1F2228] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0B0D0F]">
              <tr>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Time</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Amount (USDC)</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Chain</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Tip</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Transaction Signature</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Status</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2228]">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-[#1F2228]/50 transition-colors">
                  <td className="px-6 py-4 text-[#E7ECEF]">{payment.time}</td>
                  <td className="px-6 py-4 text-[#E7ECEF]">${payment.amount}</td>
                  <td className="px-6 py-4 text-[#00E7FF]">{payment.chain}</td>
                  <td className="px-6 py-4 text-[#E7ECEF]">${payment.tip}</td>
                  <td className="px-6 py-4 text-[#A5B6C8]">{payment.signature}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-[#00E7FF]/10 text-[#00E7FF] rounded-full">
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={getExplorerUrl(payment.chain, payment.tx_signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00E7FF] hover:text-[#3457FF] transition-colors cursor-pointer"
                    >
                      View Details
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
