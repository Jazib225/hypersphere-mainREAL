import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { useState, useEffect } from "react";
import { fetchMerchantPayments, formatAmount, type Payment } from "../../utils/api";

// Merchant ID - update this with your actual merchant wallet address
const MERCHANT_ID = "4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U";

// Merchant wallet address for display
const MERCHANT_WALLET = "4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U";

function formatAddress(address: string): string {
  if (!address) return "N/A";
  if (address.length <= 8) return address;
  return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
}

export function Balances() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch payments from backend
  useEffect(() => {
    async function loadPayments() {
      try {
        const data = await fetchMerchantPayments(MERCHANT_ID);
        setPayments(data.payments);
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

  // Calculate balances by chain from actual payments
  const chainBalances = payments.reduce((acc, p) => {
    const chain = p.chain || (p.currency === "USDC" ? "Solana" : p.currency || "Solana");
    // Normalize chain names
    const normalizedChain = chain === "SOL" ? "Solana" : 
                           chain === "ETH" ? "Ethereum" :
                           chain === "BASE" ? "Base" : chain;
    
    if (!acc[normalizedChain]) {
      acc[normalizedChain] = 0;
    }
    acc[normalizedChain] += p.amount;
    return acc;
  }, {} as Record<string, number>);

  const totalBalance = Object.values(chainBalances).reduce((sum, val) => sum + val, 0);

  // Create balances array with percentages
  const balances = Object.entries(chainBalances)
    .map(([chain, balance]) => ({
      chain,
      balance,
      percentage: totalBalance > 0 ? Math.round((balance / totalBalance) * 100) : 0,
      address: formatAddress(MERCHANT_WALLET)
    }))
    .sort((a, b) => b.balance - a.balance);

  // Calculate 7-day inflow history
  const now = new Date();
  const inflowData = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - (6 - i));
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    const amount = payments
      .filter(p => {
        const pDate = new Date(p.created_at);
        return pDate >= dayStart && pDate < dayEnd;
      })
      .reduce((sum, p) => sum + p.amount, 0);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      day: dayNames[dayStart.getDay()],
      amount: amount
    };
  });

  // Chain comparison data for bar chart
  const chainComparisonData = balances.map(b => ({
    chain: b.chain,
    balance: b.balance
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#A5B6C8]">Loading balances...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Balance Card */}
      <div className="bg-gradient-to-br from-[#00E7FF]/10 to-[#3457FF]/10 border border-[#00E7FF]/30 rounded-lg p-8">
        <div className="text-[#A5B6C8] mb-2">Total USDC Balance</div>
        <div className="text-[#E7ECEF] mb-4">${formatAmount(totalBalance)}</div>
        <div className="text-[#00E7FF]">Across {balances.length} chain{balances.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Chain Balances */}
      <div className={`grid gap-6 ${balances.length === 1 ? 'grid-cols-1' : balances.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {balances.length > 0 ? (
          balances.map((balance) => (
            <div key={balance.chain} className="bg-[#121417] border border-[#1F2228] rounded-lg p-6 hover:border-[#00E7FF]/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[#00E7FF]">{balance.chain}</div>
                <div className="text-[#A5B6C8]">{balance.percentage}%</div>
              </div>
              <div className="text-[#E7ECEF] mb-2">${formatAmount(balance.balance)}</div>
              <div className="text-[#A5B6C8] mb-4">{balance.address}</div>
              <div className="w-full bg-[#1F2228] rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-[#00E7FF] to-[#3457FF] h-2 rounded-full"
                  style={{ width: `${balance.percentage}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 text-center text-[#A5B6C8] py-8">
            No balance data available
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Historical Inflow */}
        <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
          <h3 className="text-[#E7ECEF] mb-6">7-Day Inflow History</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={inflowData}>
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
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#00E7FF"
                strokeWidth={2}
                dot={{ fill: "#00E7FF", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Multi-Chain Balance Comparison */}
        <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
          <h3 className="text-[#E7ECEF] mb-6">Multi-Chain Balance Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chainComparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2228" />
              <XAxis dataKey="chain" stroke="#A5B6C8" />
              <YAxis stroke="#A5B6C8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#121417",
                  border: "1px solid #1F2228",
                  borderRadius: "8px",
                  color: "#E7ECEF",
                }}
              />
              <Bar dataKey="balance" fill="#00E7FF" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Balance Table */}
      <div className="bg-[#121417] border border-[#1F2228] rounded-lg overflow-hidden">
        <div className="p-6 border-b border-[#1F2228]">
          <h3 className="text-[#E7ECEF]">Balance Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0B0D0F]">
              <tr>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Chain</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Balance (USDC)</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Percentage</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Wallet Address</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2228]">
              {balances.length > 0 ? (
                balances.map((balance) => (
                  <tr key={balance.chain} className="hover:bg-[#1F2228]/50 transition-colors">
                    <td className="px-6 py-4 text-[#00E7FF]">{balance.chain}</td>
                    <td className="px-6 py-4 text-[#E7ECEF]">${formatAmount(balance.balance)}</td>
                    <td className="px-6 py-4 text-[#E7ECEF]">{balance.percentage}%</td>
                    <td className="px-6 py-4 text-[#A5B6C8]">{balance.address}</td>
                    <td className="px-6 py-4">
                      <button className="text-[#00E7FF] hover:text-[#3457FF] transition-colors">
                        View Transactions
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#A5B6C8]">
                    No balance data available
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
