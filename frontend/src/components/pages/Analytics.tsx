import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState, useEffect } from "react";
import { fetchMerchantPayments, formatAmount, type Payment } from "../../utils/api";

// Merchant ID - update this with your actual merchant wallet address
const MERCHANT_ID = "4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U";

export function Analytics() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch payments from backend
  useEffect(() => {
    async function loadPayments() {
      try {
        const data = await fetchMerchantPayments(MERCHANT_ID);
        // Always replace with fresh data from backend (ensures new transactions appear)
        setPayments(data.payments || []);
      } catch (err) {
        console.error("Failed to load payments:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPayments();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadPayments, 10000);
    return () => clearInterval(interval);
  }, []);

  // Calculate daily sales for last 7 days
  const now = new Date();
  const dailySalesData = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - (6 - i));
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const sales = payments
      .filter(p => {
        const pDate = new Date(p.created_at);
        return pDate >= dayStart && pDate < dayEnd;
      })
      .reduce((sum, p) => sum + p.amount, 0);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      day: dayNames[dayStart.getDay()],
      sales: sales
    };
  });

  // Calculate peak hour transactions
  const peakHourData = Array.from({ length: 8 }, (_, i) => {
    const hour = 8 + i * 2;
    const hourStart = new Date(now);
    hourStart.setHours(hour, 0, 0, 0);
    const hourEnd = new Date(hourStart);
    hourEnd.setHours(hour + 2, 0, 0, 0);
    const transactions = payments.filter(p => {
      const pDate = new Date(p.created_at);
      return pDate >= hourStart && pDate < hourEnd;
    }).length;
    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      transactions: transactions
    };
  });

  // Calculate chain performance from actual data
  const chainStats = payments.reduce((acc, p) => {
    const chain = p.chain || (p.currency === "USDC" ? "Solana" : p.currency || "Solana");
    if (!acc[chain]) {
      acc[chain] = { volume: 0, transactions: 0 };
    }
    acc[chain].volume += p.amount;
    acc[chain].transactions += 1;
    return acc;
  }, {} as Record<string, { volume: number; transactions: number }>);

  const chainPerformanceData = Object.entries(chainStats).map(([chain, stats]) => ({
    chain: chain,
    avgSpeed: chain === "Solana" || chain === "SOL" ? "0.4s" : 
             chain === "Base" || chain === "BASE" ? "2.1s" : "12.3s",
    volume: stats.volume,
    transactions: stats.transactions,
    avgTransactionSize: stats.transactions > 0 ? stats.volume / stats.transactions : 0
  }));

  // Calculate metrics
  const last7Days = payments.filter(p => {
    const pDate = new Date(p.created_at);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    return pDate >= sevenDaysAgo;
  });

  const totalRevenue7d = last7Days.reduce((sum, p) => sum + p.amount, 0);
  const totalTransactions7d = last7Days.length;
  const avgTransactionValue = totalTransactions7d > 0 ? totalRevenue7d / totalTransactions7d : 0;

  // Calculate percentage change (simplified - comparing last 7 days to previous 7 days)
  const previous7Days = payments.filter(p => {
    const pDate = new Date(p.created_at);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 14);
    return pDate >= fourteenDaysAgo && pDate < sevenDaysAgo;
  });

  const prevRevenue7d = previous7Days.reduce((sum, p) => sum + p.amount, 0);
  const prevTransactions7d = previous7Days.length;
  const prevAvgTransactionValue = prevTransactions7d > 0 ? prevRevenue7d / prevTransactions7d : 0;

  const revenueChange = prevRevenue7d > 0 ? ((totalRevenue7d - prevRevenue7d) / prevRevenue7d) * 100 : 0;
  const transactionsChange = prevTransactions7d > 0 ? ((totalTransactions7d - prevTransactions7d) / prevTransactions7d) * 100 : 0;
  const avgValueChange = prevAvgTransactionValue > 0 ? ((avgTransactionValue - prevAvgTransactionValue) / prevAvgTransactionValue) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#A5B6C8]">Loading analytics...</div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
          <div className="text-[#A5B6C8] mb-2">Total Revenue (7d)</div>
          <div className="text-[#E7ECEF] mb-1">${formatAmount(totalRevenue7d)}</div>
          <div className={revenueChange >= 0 ? "text-[#00E7FF]" : "text-red-400"}>
            {revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(1)}%
          </div>
        </div>
        <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
          <div className="text-[#A5B6C8] mb-2">Total Transactions (7d)</div>
          <div className="text-[#E7ECEF] mb-1">{totalTransactions7d.toLocaleString()}</div>
          <div className={transactionsChange >= 0 ? "text-[#00E7FF]" : "text-red-400"}>
            {transactionsChange >= 0 ? "+" : ""}{transactionsChange.toFixed(1)}%
          </div>
        </div>
        <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
          <div className="text-[#A5B6C8] mb-2">Avg Transaction Value</div>
          <div className="text-[#E7ECEF] mb-1">${formatAmount(avgTransactionValue)}</div>
          <div className={avgValueChange >= 0 ? "text-[#00E7FF]" : "text-red-400"}>
            {avgValueChange >= 0 ? "+" : ""}{avgValueChange.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Daily Sales Bar Chart */}
      <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
        <h3 className="text-[#E7ECEF] mb-6">Daily Sales (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailySalesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2228" />
            <XAxis dataKey="day" stroke="#A5B6C8" />
            <YAxis stroke="#A5B6C8" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#121417",
                border: "1px solid #1F2228",
                borderRadius: "8px",
                color: "#E7ECEF",
              }}
            />
            <Bar dataKey="sales" fill="#00E7FF" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Peak Hour Histogram */}
      <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
        <h3 className="text-[#E7ECEF] mb-6">Peak Transaction Hours</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={peakHourData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2228" />
            <XAxis dataKey="hour" stroke="#A5B6C8" />
            <YAxis stroke="#A5B6C8" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#121417",
                border: "1px solid #1F2228",
                borderRadius: "8px",
                color: "#E7ECEF",
              }}
            />
            <Bar dataKey="transactions" fill="#00E7FF" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chain Performance Table */}
      <div className="bg-[#121417] border border-[#1F2228] rounded-lg overflow-hidden">
        <div className="p-6 border-b border-[#1F2228]">
          <h3 className="text-[#E7ECEF]">Chain Performance Analytics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0B0D0F]">
              <tr>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Chain</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Avg Confirmation Speed</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Total Volume (USDC)</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Total Transactions</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Avg Transaction Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2228]">
              {chainPerformanceData.length > 0 ? (
                chainPerformanceData.map((chain) => (
                  <tr key={chain.chain} className="hover:bg-[#1F2228]/50 transition-colors">
                    <td className="px-6 py-4 text-[#00E7FF]">{chain.chain}</td>
                    <td className="px-6 py-4 text-[#E7ECEF]">{chain.avgSpeed}</td>
                    <td className="px-6 py-4 text-[#E7ECEF]">${formatAmount(chain.volume)}</td>
                    <td className="px-6 py-4 text-[#E7ECEF]">{chain.transactions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-[#E7ECEF]">
                      ${formatAmount(chain.avgTransactionSize)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#A5B6C8]">
                    No chain performance data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}