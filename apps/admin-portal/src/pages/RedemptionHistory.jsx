import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../services/api';
import Layout from '../components/Layout';
import { formatEsproCoinsDisplay } from '../utils/format';

export default function RedemptionHistory() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedReward, setSelectedReward] = useState('');
  const [selectedUser, setSelectedUser] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['redemption-history', page, search, selectedReward, selectedUser],
    queryFn: () => adminAPI.getRedemptionHistory({
      page,
      limit: 20,
      search,
      rewardId: selectedReward || undefined,
      userId: selectedUser || undefined,
    }),
  });

  const claims = data?.data?.claims || [];
  const pagination = data?.data?.pagination || {};

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Redemption History</h1>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Voucher Code</label>
              <input
                type="text"
                placeholder="Search by voucher code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-espro-orange focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Reward</label>
              <input
                type="text"
                placeholder="Reward ID..."
                value={selectedReward}
                onChange={(e) => {
                  setSelectedReward(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-espro-orange focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by User</label>
              <input
                type="text"
                placeholder="User ID..."
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-espro-orange focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading redemption history...</div>
        ) : claims.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            No redemption history found
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voucher Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coins Deducted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {claims.map((claim) => (
                    <tr key={claim._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(claim.claimedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{claim.user?.name || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{claim.user?.email || 'N/A'}</div>
                        {claim.user?.loyaltyId && (
                          <div className="text-xs text-gray-400 font-mono">{claim.user.loyaltyId}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{claim.reward?.title || 'N/A'}</div>
                        {claim.reward?.esproCoinsRequired && (
                          <div className="text-xs text-gray-500">
                            {formatEsproCoinsDisplay(claim.reward.esproCoinsRequired)} coins
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900">{claim.voucherCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-espro-orange">
                          {formatEsproCoinsDisplay(claim.esproCoinsDeducted)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          claim.isUsed 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {claim.isUsed ? 'Used' : 'Available'}
                        </span>
                        {claim.usedAt && (
                          <div className="text-xs text-gray-500 mt-1">
                            Used: {new Date(claim.usedAt).toLocaleString()}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, pagination.total)} of {pagination.total} redemptions
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

