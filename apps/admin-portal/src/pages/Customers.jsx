import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../services/api';
import Layout from '../components/Layout';
import { formatEsproCoinsDisplay } from '../utils/format';

export default function Customers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingPoints, setEditingPoints] = useState(false);
  const [pointsData, setPointsData] = useState({ esproCoins: '', lifetimeEsproCoins: '' });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => adminAPI.getCustomers({ page, limit: 10, search }),
  });

  const handleUpdatePoints = async () => {
    try {
      await adminAPI.updateCustomerPoints(selectedCustomer._id, pointsData);
      setEditingPoints(false);
      setSelectedCustomer(null);
      refetch();
      alert('Points updated successfully');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update points');
    }
  };

  const handleViewCustomer = (customer) => {
    setSelectedCustomer(customer);
    setPointsData({
      esproCoins: customer.esproCoins || 0,
      lifetimeEsproCoins: customer.lifetimeEsproCoins || 0,
    });
  };

  const handleSyncOdoo = async () => {
    setSyncing(true);
    setSyncError('');
    setSyncResult(null);

    try {
      const response = await adminAPI.syncOdooPoints();
      setSyncResult(response.data);
      setLastSyncTime(new Date().toLocaleString());
      refetch(); // Refresh customer list
    } catch (err) {
      setSyncError(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <div className="flex gap-4">
            <button
              onClick={handleSyncOdoo}
              disabled={syncing}
              className="bg-espro-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync from Odoo
                </>
              )}
            </button>
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-espro-orange focus:border-transparent"
            />
          </div>
        </div>

        {/* Sync Result Messages */}
        {syncError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {syncError}
          </div>
        )}

        {syncResult && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            <div className="font-semibold mb-1">Sync Successful!</div>
            <div>
              Processed: {syncResult.processed || 0} loyalty cards | 
              Updated: {syncResult.updated || 0} customers
              {syncResult.notFound > 0 && ` | Not found: ${syncResult.notFound}`}
              {syncResult.errors > 0 && ` | Errors: ${syncResult.errors}`}
            </div>
            {lastSyncTime && (
              <div className="text-xs mt-1 text-green-600">Last sync: {lastSyncTime}</div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading customers...</div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loyalty ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Coins</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Earned Espro Coins</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.data?.customers?.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{customer.loyaltyId || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{formatEsproCoinsDisplay(customer.esproCoins || 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{formatEsproCoinsDisplay(customer.lifetimeEsproCoins || 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleViewCustomer(customer)}
                          className="text-espro-orange hover:underline font-medium"
                        >
                          View/Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data?.data?.pagination && (
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  Showing {((page - 1) * 10) + 1} to {Math.min(page * 10, data.data.pagination.total)} of {data.data.pagination.total} customers
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
                    disabled={page >= data.data.pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Customer Detail Modal */}
        {selectedCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => !editingPoints && setSelectedCustomer(null)}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">Customer Details</h2>
              <div className="space-y-3 mb-6">
                <div>
                  <label className="text-sm text-gray-600">Name</label>
                  <div className="text-lg font-semibold">{selectedCustomer.name}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Email</label>
                  <div className="text-lg">{selectedCustomer.email}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Loyalty ID</label>
                  <div className="text-lg font-mono">{selectedCustomer.loyaltyId || 'N/A'}</div>
                </div>
                {editingPoints ? (
                  <>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Current Espro Coins</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={pointsData.esproCoins}
                        onChange={(e) => setPointsData({ ...pointsData, esproCoins: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Total Earned Espro Coins</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={pointsData.lifetimeEsproCoins}
                        onChange={(e) => setPointsData({ ...pointsData, lifetimeEsproCoins: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={handleUpdatePoints}
                        className="flex-1 bg-espro-orange text-white py-2 rounded-lg font-medium hover:bg-orange-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingPoints(false);
                          setPointsData({
                            esproCoins: selectedCustomer.esproCoins || 0,
                            lifetimeEsproCoins: selectedCustomer.lifetimeEsproCoins || 0,
                          });
                        }}
                        className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-sm text-gray-600">Current Espro Coins</label>
                      <div className="text-lg font-semibold text-espro-orange">{formatEsproCoinsDisplay(selectedCustomer.esproCoins || 0)}</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Total Earned Espro Coins</label>
                      <div className="text-lg font-semibold text-espro-teal">{formatEsproCoinsDisplay(selectedCustomer.lifetimeEsproCoins || 0)}</div>
                    </div>
                    <button
                      onClick={() => setEditingPoints(true)}
                      className="w-full bg-espro-orange text-white py-2 rounded-lg font-medium hover:bg-orange-600 mt-4"
                    >
                      Edit Points
                    </button>
                  </>
                )}
              </div>
              {!editingPoints && (
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

