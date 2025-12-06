import { useState, useEffect } from "react";
import { fetchMerchantPayments } from "../../utils/api";

interface Device {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  lastSync: string;
  location: string;
  transactions: number;
}

const MERCHANT_ID = "4UznnYY4AMzAmss6AqeAvqUs5KeWYNinzKE2uFFQZ16U";

export function Devices() {
  const [devices, setDevices] = useState<Device[]>([
    { id: "1", name: "Android Terminal", status: "Active", lastSync: "Just now", location: "Main Store", transactions: 0 },
  ]);
  const [loading, setLoading] = useState(true);

  // Fetch payments to get transaction count
  useEffect(() => {
    async function loadPayments() {
      try {
        const data = await fetchMerchantPayments(MERCHANT_ID);
        const transactionCount = data.payments.length;
        
        setDevices([
          { 
            id: "1", 
            name: "Android Terminal", 
            status: "Active", 
            lastSync: "Just now", 
            location: "Main Store", 
            transactions: transactionCount 
          }
        ]);
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceLocation, setNewDeviceLocation] = useState("");

  const handleAddDevice = () => {
    if (newDeviceName && newDeviceLocation) {
      const newDevice: Device = {
        id: String(devices.length + 1),
        name: newDeviceName,
        status: "Active",
        lastSync: "Just now",
        location: newDeviceLocation,
        transactions: 0,
      };
      setDevices([...devices, newDevice]);
      setNewDeviceName("");
      setNewDeviceLocation("");
      setShowAddModal(false);
    }
  };

  const handleRemoveDevice = (id: string) => {
    setDevices(devices.filter(device => device.id !== id));
  };

  const activeDevices = devices.filter(d => d.status === "Active").length;
  const totalTransactions = devices.reduce((sum, d) => sum + d.transactions, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#A5B6C8]">Loading devices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
          <div className="text-[#A5B6C8] mb-2">Total Devices</div>
          <div className="text-[#E7ECEF] mb-1">{devices.length}</div>
          <div className="text-[#00E7FF]">{activeDevices} active</div>
        </div>
        <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
          <div className="text-[#A5B6C8] mb-2">Total Transactions</div>
          <div className="text-[#E7ECEF] mb-1">{totalTransactions.toLocaleString()}</div>
          <div className="text-[#00E7FF]">Across all devices</div>
        </div>
        <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-6">
          <div className="text-[#A5B6C8] mb-2">Avg Transactions per Device</div>
          <div className="text-[#E7ECEF] mb-1">{Math.round(totalTransactions / devices.length)}</div>
          <div className="text-[#00E7FF]">Last 30 days</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-[#E7ECEF]">Connected NFC Terminals</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-2 bg-gradient-to-r from-[#00E7FF] to-[#3457FF] text-[#0B0D0F] rounded-lg hover:opacity-90 transition-opacity"
        >
          Add Device
        </button>
      </div>

      {/* Devices Table */}
      <div className="bg-[#121417] border border-[#1F2228] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0B0D0F]">
              <tr>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Device Name</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Status</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Last Sync</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Location</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Transactions</th>
                <th className="px-6 py-4 text-left text-[#A5B6C8]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2228]">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-[#1F2228]/50 transition-colors">
                  <td className="px-6 py-4 text-[#E7ECEF]">{device.name}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full ${
                        device.status === "Active"
                          ? "bg-[#00E7FF]/10 text-[#00E7FF]"
                          : "bg-[#A5B6C8]/10 text-[#A5B6C8]"
                      }`}
                    >
                      {device.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#A5B6C8]">{device.lastSync}</td>
                  <td className="px-6 py-4 text-[#E7ECEF]">{device.location}</td>
                  <td className="px-6 py-4 text-[#E7ECEF]">{device.transactions.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="text-[#00E7FF] hover:text-[#3457FF] transition-colors">
                        Configure
                      </button>
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="text-[#A5B6C8] hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#121417] border border-[#1F2228] rounded-lg p-8 w-full max-w-md">
            <h3 className="text-[#E7ECEF] mb-6">Add New Device</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[#A5B6C8] mb-2">Device Name</label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="Terminal - Location Name"
                  className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
                />
              </div>
              
              <div>
                <label className="block text-[#A5B6C8] mb-2">Location</label>
                <input
                  type="text"
                  value={newDeviceLocation}
                  onChange={(e) => setNewDeviceLocation(e.target.value)}
                  placeholder="Store location"
                  className="w-full bg-[#0B0D0F] border border-[#1F2228] rounded-lg px-4 py-2 text-[#E7ECEF] focus:outline-none focus:border-[#00E7FF]"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddDevice}
                className="flex-1 px-6 py-2 bg-gradient-to-r from-[#00E7FF] to-[#3457FF] text-[#0B0D0F] rounded-lg hover:opacity-90 transition-opacity"
              >
                Add Device
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-6 py-2 bg-[#1F2228] text-[#E7ECEF] rounded-lg hover:bg-[#2A2D35] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
