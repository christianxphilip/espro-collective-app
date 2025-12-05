import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI, rewardsAPI, promotionsAPI, collectiblesAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminAPI.getDashboard().then((res) => res.data.stats),
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <div className="text-espro-orange text-2xl font-bold">ESPRO Admin</div>
        </div>
        <nav className="p-4 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'customers', label: 'Customers', icon: '👥' },
            { id: 'rewards', label: 'Rewards', icon: '🎁' },
            { id: 'promotions', label: 'Promotions', icon: '📢' },
            { id: 'collections', label: 'Card Designs', icon: '🎨' },
            { id: 'loyalty-ids', label: 'Loyalty IDs', icon: '🆔' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                activeTab === item.id
                  ? 'bg-espro-orange text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded-lg text-red-600 hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {activeTab === 'dashboard' && (
          <div>
            <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
            {stats && (
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-gray-600 text-sm">Total Customers</div>
                  <div className="text-3xl font-bold text-gray-800">{stats.totalCustomers}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-gray-600 text-sm">Total Rewards</div>
                  <div className="text-3xl font-bold text-gray-800">{stats.totalRewards}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-gray-600 text-sm">Total Claims</div>
                  <div className="text-3xl font-bold text-gray-800">{stats.totalClaims}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-gray-600 text-sm">Available IDs</div>
                  <div className="text-3xl font-bold text-gray-800">{stats.availableLoyaltyIds}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'customers' && (
          <div>
            <h1 className="text-3xl font-bold mb-6">Customers</h1>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600">Customer management coming soon...</p>
            </div>
          </div>
        )}

        {activeTab === 'rewards' && (
          <div>
            <h1 className="text-3xl font-bold mb-6">Rewards</h1>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600">Rewards management coming soon...</p>
            </div>
          </div>
        )}

        {activeTab === 'promotions' && (
          <div>
            <h1 className="text-3xl font-bold mb-6">Promotions</h1>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600">Promotions management coming soon...</p>
            </div>
          </div>
        )}

        {activeTab === 'collections' && (
          <div>
            <h1 className="text-3xl font-bold mb-6">Card Designs</h1>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600">Card designs management coming soon...</p>
            </div>
          </div>
        )}

        {activeTab === 'loyalty-ids' && (
          <div>
            <h1 className="text-3xl font-bold mb-6">Loyalty IDs</h1>
            <div className="bg-white p-6 rounded-lg shadow">
              <p className="text-gray-600">Loyalty IDs management coming soon...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

