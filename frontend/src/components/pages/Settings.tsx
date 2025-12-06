import { useState, useEffect } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MERCHANT_ID = "4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U";

export function Settings() {
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessType, setBusinessType] = useState("Retail");
  const [solanaAddress, setSolanaAddress] = useState("");
  const [baseAddress, setBaseAddress] = useState("");
  const [ethereumAddress, setEthereumAddress] = useState("");
  const [preferredChain, setPreferredChain] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load settings from backend
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch(`${API_BASE_URL}/merchants/${MERCHANT_ID}/settings`);
        if (response.ok) {
          const data = await response.json();
          setBusinessName(data.name || "");
          setBusinessEmail(data.email || "");
          setBusinessType(data.business_type || "Retail");
          setSolanaAddress(data.solana_address || data.wallet_address || "");
          setBaseAddress(data.base_address || "");
          setEthereumAddress(data.ethereum_address || "");
          setPreferredChain(data.preferred_chain || "");
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/merchants/${MERCHANT_ID}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: businessName,
          email: businessEmail,
          business_type: businessType,
          solana_address: solanaAddress,
          base_address: baseAddress,
          ethereum_address: ethereumAddress,
          preferred_chain: preferredChain || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSaveMessage("Settings saved successfully!");
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        let errorMessage = 'Failed to save settings';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        setSaveMessage(`Error: ${errorMessage}`);
        console.error("Save failed:", errorMessage);
      }
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setSaveMessage(`Error: Cannot connect to backend server. Make sure the backend is running on ${API_BASE_URL}`);
      } else {
        setSaveMessage(`Error: ${err.message || 'Failed to save settings'}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#A5B6C8]">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Business Profile */}
      <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
        <h3 className="text-[#E7ECEF] mb-6">Business Profile</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[#A5B6C8] mb-2">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
            />
          </div>
          
          <div>
            <label className="block text-[#A5B6C8] mb-2">Business Email</label>
            <input
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
            />
          </div>

          <div>
            <label className="block text-[#A5B6C8] mb-2">Business Type</label>
            <select 
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
            >
              <option>Retail</option>
              <option>Food & Beverage</option>
              <option>Services</option>
              <option>E-commerce</option>
              <option>Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Wallet Addresses */}
      <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
        <h3 className="text-[#E7ECEF] mb-6">Wallet Addresses</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[#A5B6C8] mb-2">Solana Wallet Address</label>
            <input
              type="text"
              value={solanaAddress}
              onChange={(e) => setSolanaAddress(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF] font-mono"
            />
          </div>
          
          <div>
            <label className="block text-[#A5B6C8] mb-2">Base Wallet Address</label>
            <input
              type="text"
              value={baseAddress}
              onChange={(e) => setBaseAddress(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF] font-mono"
            />
          </div>

          <div>
            <label className="block text-[#A5B6C8] mb-2">Ethereum Wallet Address</label>
            <input
              type="text"
              value={ethereumAddress}
              onChange={(e) => setEthereumAddress(e.target.value)}
              className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF] font-mono"
            />
          </div>
        </div>
      </div>

      {/* Preferred Chain */}
      <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
        <h3 className="text-[#E7ECEF] mb-6">Preferred Chain (Optional)</h3>
        
        <div className="space-y-3">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="preferredChain"
              value="SOL"
              checked={preferredChain === "SOL"}
              onChange={(e) => setPreferredChain(e.target.value)}
              className="w-4 h-4 text-[#00E7FF] bg-[#0B0D0F] border-[#1F2228] focus:ring-[#00E7FF] focus:ring-2"
            />
            <span className="text-[#E7ECEF]" style={{ marginLeft: '12px' }}>SOL</span>
          </label>
          
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="preferredChain"
              value="BASE"
              checked={preferredChain === "BASE"}
              onChange={(e) => setPreferredChain(e.target.value)}
              className="w-4 h-4 text-[#00E7FF] bg-[#0B0D0F] border-[#1F2228] focus:ring-[#00E7FF] focus:ring-2"
            />
            <span className="text-[#E7ECEF]" style={{ marginLeft: '12px' }}>BASE</span>
          </label>
          
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="preferredChain"
              value="ETH"
              checked={preferredChain === "ETH"}
              onChange={(e) => setPreferredChain(e.target.value)}
              className="w-4 h-4 text-[#00E7FF] bg-[#0B0D0F] border-[#1F2228] focus:ring-[#00E7FF] focus:ring-2"
            />
            <span className="text-[#E7ECEF]" style={{ marginLeft: '12px' }}>ETH</span>
          </label>
          
          <button
            type="button"
            onClick={() => setPreferredChain("")}
            className="text-sm text-[#A5B6C8] hover:text-[#00E7FF] transition-colors mt-2"
          >
            Clear selection
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end items-center gap-4">
        {saveMessage && (
          <div className={`text-sm ${saveMessage.includes("Error") ? "text-red-400" : "text-green-400"}`}>
            {saveMessage}
          </div>
        )}
        <button
          onClick={() => {}}
          className="px-8 py-3 bg-[#1F2228] border border-[#1F2228] text-[#E7ECEF] rounded-lg hover:bg-[#2A2D35] transition-colors"
        >
          Rebalance Portfolio
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-gradient-to-r from-[#00E7FF] to-[#3457FF] text-[#0B0D0F] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save All Changes"}
        </button>
      </div>
    </div>
  );
}
