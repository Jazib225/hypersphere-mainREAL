import { Outlet, NavLink, useLocation } from "react-router";
import logo from "../assets/c1ca47751eac5607c1cfa1b0681c410dcb27e84d.png";
import profileIcon from "../assets/fc099acc0805933e139739c70c81c58fd849e69a.png";

const navItems = [
  { path: "/", label: "Overview" },
  { path: "/payments", label: "Payments" },
  { path: "/balances", label: "Balances" },
  { path: "/analytics", label: "Analytics" },
  { path: "/devices", label: "Devices" },
  { path: "/settings", label: "Settings" },
];

export function Layout() {
  const location = useLocation();
  
  const getPageTitle = () => {
    const currentNav = navItems.find(item => item.path === location.pathname);
    return currentNav?.label || "Overview";
  };

  return (
    <div className="flex h-screen bg-[#0B0D0F] text-[#E7ECEF] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-[#121417] border-r border-[#1F2228] flex flex-col">
        <div className="p-6 border-b border-[#1F2228]">
          <img src={logo} alt="HyperSphere" className="h-10 w-auto" />
        </div>
        
        <nav className="flex-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `block px-4 py-3 mb-1 rounded-lg transition-all ${
                  isActive
                    ? "bg-[#00E7FF]/10 text-[#00E7FF]"
                    : "text-[#A5B6C8] hover:bg-[#1F2228] hover:text-[#E7ECEF]"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#121417] border-b border-[#1F2228] flex items-center justify-between px-8">
          <h1 className="text-[#E7ECEF]">{getPageTitle()}</h1>
          <div className="flex items-center gap-4">
            <a 
              href="https://x.com/HyperSphereBC" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#00E7FF"/>
              </svg>
            </a>
            <img src={profileIcon} alt="Profile" className="w-10 h-10 rounded-full" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}