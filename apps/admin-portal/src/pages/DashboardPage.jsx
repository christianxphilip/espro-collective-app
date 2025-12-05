import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../services/api';
import Layout from '../components/Layout';

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminAPI.getDashboard().then((res) => res.data.stats),
  });

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading dashboard...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Customers</div>
              <div className="text-3xl font-bold text-gray-800">{stats?.totalCustomers || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Rewards</div>
              <div className="text-3xl font-bold text-gray-800">{stats?.totalRewards || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Claims</div>
              <div className="text-3xl font-bold text-gray-800">{stats?.totalClaims || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Available IDs</div>
              <div className="text-3xl font-bold text-gray-800">{stats?.availableLoyaltyIds || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Promotions</div>
              <div className="text-3xl font-bold text-gray-800">{stats?.totalPromotions || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Coins Distributed</div>
              <div className="text-3xl font-bold text-espro-orange">{stats?.totalCoinsDistributed || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Lifetime Coins</div>
              <div className="text-3xl font-bold text-espro-teal">{stats?.totalLifetimeCoins || 0}</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Loyalty IDs</div>
              <div className="text-3xl font-bold text-gray-800">{stats?.totalLoyaltyIds || 0}</div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

