import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { fetchMerchantPayments, formatAmount, formatDateTime, formatTxSignature, getExplorerUrl, type Payment } from "../../utils/api";

// Merchant ID - update this with your actual merchant wallet address
const MERCHANT_ID = "4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U";

// Maximum number of transactions to show in the table
const MAX_TABLE_TRANSACTIONS = 20;

// Backend URL for WebSocket
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Generate mock transaction signature
function generateMockTxSignature(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  return Array.from({length: 88}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

// Generate explorer URL based on chain
function generateExplorerUrl(chain: string, txSignature: string): string {
  const chainUpper = chain.toUpperCase();
  switch (chainUpper) {
    case 'SOL':
    case 'SOLANA':
      return `https://solscan.io/tx/${txSignature}`;
    case 'ETH':
    case 'ETHEREUM':
      return `https://etherscan.io/tx/${txSignature}`;
    case 'BASE':
      return `https://basescan.org/tx/${txSignature}`;
    default:
      return `https://solscan.io/tx/${txSignature}`;
  }
}

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
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  
  // Tap-to-Pay simulation state
  const [simAmount, setSimAmount] = useState<string>("0.06");
  const [simTipPercent, setSimTipPercent] = useState<string>("15");
  const [simChain, setSimChain] = useState<string>("SOL");
  const [simLoading, setSimLoading] = useState(false);
  const [simMessage, setSimMessage] = useState<string>("");
  
  // Calculate tip and total for simulation
  const simBaseAmount = parseFloat(simAmount) || 0;
  const simTipAmount = simBaseAmount * (parseFloat(simTipPercent) || 0) / 100;
  const simTotalAmount = simBaseAmount + simTipAmount;
  
  // Handle tap-to-pay simulation
  const handleSimulateTapToPay = async () => {
    if (simBaseAmount <= 0) {
      setSimMessage("❌ Please enter a valid amount");
      return;
    }
    
    setSimLoading(true);
    setSimMessage("📡 Sending transaction...");
    
    try {
      const txSignature = generateMockTxSignature();
      const explorerUrl = generateExplorerUrl(simChain, txSignature);
      
      const response = await fetch(`${API_BASE_URL}/transactions/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_intent_id: `tap-${Date.now()}`,
          merchant_id: MERCHANT_ID,
          amount: simBaseAmount,
          tip_amount: simTipAmount,
          chain: simChain,
          currency: 'USDC',
          tx_signature: txSignature,
          explorer_url: explorerUrl,
          status: 'paid',
          source: 'WEB_SIMULATION'
        })
      });
      
      if (response.ok) {
        setSimMessage(`✅ Transaction recorded! $${simTotalAmount.toFixed(2)} ${simChain}`);
        console.log("✅ Tap-to-Pay simulation successful!");
      } else {
        const error = await response.text();
        setSimMessage(`❌ Failed: ${error}`);
      }
    } catch (err) {
      setSimMessage(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error("Simulation error:", err);
    } finally {
      setSimLoading(false);
      // Clear message after 3 seconds
      setTimeout(() => setSimMessage(""), 3000);
    }
  };

  // WebSocket connection for real-time updates
  useEffect(() => {
    console.log("🔌 Connecting to WebSocket...");
    
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log("✅ WebSocket connected!");
      setWsConnected(true);
      // Join merchant room
      socket.emit('join:merchant', MERCHANT_ID);
      console.log(`📊 Joined merchant room: ${MERCHANT_ID}`);
    });

    socket.on('disconnect', () => {
      console.log("❌ WebSocket disconnected");
      setWsConnected(false);
    });

    // Listen for new transactions (real-time)
    socket.on('transaction:new', (tx: Payment) => {
      console.log("🚀 REAL-TIME TRANSACTION RECEIVED!");
      console.log("   ID:", tx.id);
      console.log("   Amount: $" + tx.amount, tx.chain);
      console.log("   Tip: $" + (tx.tip_amount || 0));
      console.log("   Time:", tx.created_at);
      console.log("   Signature:", tx.tx_signature?.substring(0, 20) + "...");
      
      const txTime = new Date(tx.created_at);
      const now = new Date();
      
      // Only add if current time >= transaction time (for scheduled transactions)
      if (now < txTime) {
        console.log(`   ⏰ Scheduled transaction - will appear at ${txTime.toLocaleString()}`);
        // Still add to allPayments but it will be filtered in displayPayments
      }
      
      // Add to all payments (with deduplication)
      setAllPayments(prev => {
        // Check if already exists
        if (prev.some(p => p.id === tx.id)) {
          console.log("   ⚠️ Duplicate in allPayments, skipping");
          return prev;
        }
        return [tx, ...prev];
      });
      
      // Only add to table if time has arrived
      if (now >= txTime) {
        setTablePayments(prev => {
          // Check if already exists
          if (prev.some(p => p.id === tx.id)) {
            console.log("   ⚠️ Duplicate in tablePayments, skipping");
            return prev;
          }
          const updated = [tx, ...prev];
          // Keep only MAX
          return updated.slice(0, MAX_TABLE_TRANSACTIONS);
        });
      }
    });

    // Also listen for any transaction (debug)
    socket.on('transaction:any', (tx: Payment) => {
      console.log("📡 transaction:any event received:", tx.id);
    });

    return () => {
      console.log("🔌 Disconnecting WebSocket...");
      socket.emit('leave:merchant', MERCHANT_ID);
      socket.disconnect();
    };
  }, []);

  // Initial load from backend (HTTP)
  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true);
        const data = await fetchMerchantPayments(MERCHANT_ID);
        const newPayments = data.payments || [];
        
        // Initial load: populate both arrays
        setAllPayments(newPayments);
        setTablePayments(newPayments.slice(0, MAX_TABLE_TRANSACTIONS));
        console.log(`📊 Initial load: ${newPayments.length} total, ${Math.min(newPayments.length, MAX_TABLE_TRANSACTIONS)} in table`);
        
        setError(null);
      } catch (err) {
        console.error("Failed to load payments:", err);
        setError("Failed to load payments. Please check if the backend is running.");
      } finally {
        setLoading(false);
      }
    }

    loadPayments();
  }, []); // Only run once on mount

  // Transform table payments to display format (only show tablePayments, not allPayments)
  // Filter by time: only show transactions where current time >= transaction timestamp
  const now = new Date();
  const displayPayments = tablePayments
    .filter((payment) => {
      const txTime = new Date(payment.created_at);
      // Only show if current time >= transaction time (for scheduled transactions)
      return now >= txTime;
    })
    .map((payment) => {
      const chain = payment.chain || (payment.currency === "USDC" ? "SOL" : payment.currency || "SOL");
      return {
        id: payment.id,
        time: formatDateTime(payment.created_at),
        amount: formatAmount(payment.amount),
        rawAmount: payment.amount, // Store raw amount for filtering
        chain: chain,
        tip: formatAmount(payment.tip_amount || 0),
        signature: formatTxSignature(payment.tx_signature),
        status: "Confirmed", // All payments are confirmed
        tx_signature: payment.tx_signature,
        // Use explorer_url from transaction if available, otherwise generate it
        explorer_url: payment.explorer_url || getExplorerUrl(chain, payment.tx_signature),
      };
    });

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
      {/* Tap-to-Pay Simulation Panel */}
      <div className="bg-gradient-to-r from-[#121417] to-[#1a1d24] border border-[#00E7FF]/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#00E7FF] text-lg font-semibold">📱 Simulate Tap-to-Pay</h3>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-xs text-[#A5B6C8]">{wsConnected ? 'WebSocket Connected' : 'Connecting...'}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-[#A5B6C8] text-sm mb-2">Base Amount (USDC)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
              placeholder="0.06"
            />
          </div>
          
          <div>
            <label className="block text-[#A5B6C8] text-sm mb-2">Tip %</label>
            <select
              value={simTipPercent}
              onChange={(e) => setSimTipPercent(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
            >
              <option value="0">0%</option>
              <option value="10">10%</option>
              <option value="15">15%</option>
              <option value="18">18%</option>
              <option value="20">20%</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[#A5B6C8] text-sm mb-2">Chain</label>
            <select
              value={simChain}
              onChange={(e) => setSimChain(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
            >
              <option value="SOL">SOL (Solana)</option>
              <option value="ETH">ETH (Ethereum)</option>
              <option value="BASE">BASE</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[#A5B6C8] text-sm mb-2">Summary</label>
            <div className="bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF]">
              <span className="text-[#A5B6C8]">Base:</span> ${simBaseAmount.toFixed(2)} + 
              <span className="text-[#A5B6C8]"> Tip:</span> ${simTipAmount.toFixed(2)} = 
              <span className="text-[#00E7FF] font-bold"> ${simTotalAmount.toFixed(2)}</span>
            </div>
          </div>
          
          <div>
            <button
              onClick={handleSimulateTapToPay}
              disabled={simLoading || simBaseAmount <= 0}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-all ${
                simLoading || simBaseAmount <= 0
                  ? 'bg-[#1F2228] text-[#A5B6C8] cursor-not-allowed'
                  : 'bg-[#00E7FF] text-[#0B0D0F] hover:bg-[#00E7FF]/80 hover:scale-105'
              }`}
            >
              {simLoading ? '⏳ Sending...' : '⚡ Tap to Pay'}
            </button>
          </div>
        </div>
        
        {simMessage && (
          <div className={`mt-4 p-3 rounded-lg text-center ${
            simMessage.includes('✅') ? 'bg-green-500/20 text-green-400' : 
            simMessage.includes('❌') ? 'bg-red-500/20 text-red-400' : 
            'bg-blue-500/20 text-blue-400'
          }`}>
            {simMessage}
          </div>
        )}
      </div>

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
                      href={payment.explorer_url}
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
