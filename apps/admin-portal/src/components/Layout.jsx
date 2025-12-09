import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();
  const location = useLocation();

  // Update active tab based on current route
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/customers')) setActiveTab('customers');
    else if (path.includes('/rewards')) setActiveTab('rewards');
    else if (path.includes('/redemption-history')) setActiveTab('redemption-history');
    else if (path.includes('/promotions')) setActiveTab('promotions');
    else if (path.includes('/collections')) setActiveTab('collections');
    else if (path.includes('/referrals')) setActiveTab('referrals');
    else if (path.includes('/loyalty-ids')) setActiveTab('loyalty-ids');
    else if (path.includes('/activity-logs')) setActiveTab('activity-logs');
    else if (path.includes('/settings')) setActiveTab('settings');
    else setActiveTab('dashboard');
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/' },
    { id: 'customers', label: 'Customers', icon: '👥', path: '/customers' },
    { id: 'rewards', label: 'Rewards', icon: '🎁', path: '/rewards' },
    { id: 'redemption-history', label: 'Redemption History', icon: '📋', path: '/redemption-history' },
    { id: 'promotions', label: 'Promotions', icon: '📢', path: '/promotions' },
    { id: 'collections', label: 'Card Designs', icon: '🎨', path: '/collections' },
    { id: 'referrals', label: 'Referrals', icon: '🎫', path: '/referrals' },
    { id: 'loyalty-ids', label: 'Loyalty IDs', icon: '🆔', path: '/loyalty-ids' },
    { id: 'activity-logs', label: 'Activity Logs', icon: '📝', path: '/activity-logs' },
    { id: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
  ];

  const handleMenuClick = (item) => {
    if (item.path === '/') {
      setActiveTab('dashboard');
    } else {
      setActiveTab(item.id);
    }
    navigate(item.path);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b">
          <div className="text-espro-orange text-2xl font-bold">ESPRO Admin</div>
        </div>
        <nav className="p-4 flex-1 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                activeTab === item.id
                  ? 'bg-espro-orange text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
          >
            <span>🚪</span>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

