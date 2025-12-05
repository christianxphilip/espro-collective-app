import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../services/api';
import Layout from '../components/Layout';
import { formatEsproCoinsDisplay } from '../utils/format';

export default function LoyaltyIds() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualLoyaltyId, setManualLoyaltyId] = useState('');
  const [manualError, setManualError] = useState('');

  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['loyalty-ids', page, filter],
    queryFn: () => adminAPI.getLoyaltyIds({ page, limit: 50, filter }),
  });

  const createLoyaltyIdMutation = useMutation({
    mutationFn: (loyaltyId) => adminAPI.createLoyaltyId(loyaltyId),
    onSuccess: () => {
      queryClient.invalidateQueries(['loyalty-ids']);
      setManualLoyaltyId('');
      setShowManualAdd(false);
      setManualError('');
      alert('Loyalty ID added successfully!');
    },
    onError: (error) => {
      setManualError(error.response?.data?.message || 'Failed to add loyalty ID');
    },
  });

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const response = await adminAPI.uploadLoyaltyIds(file);
      setResult(response.data);
      setFile(null);
      document.getElementById('csv-file').value = '';
      refetch();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Loyalty IDs Management</h1>

        {/* Stats */}
        {data?.data?.stats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm">Total IDs</div>
              <div className="text-2xl font-bold text-gray-800">{data.data.stats.total}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm">Available</div>
              <div className="text-2xl font-bold text-green-600">{data.data.stats.available}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm">Assigned</div>
              <div className="text-2xl font-bold text-blue-600">{data.data.stats.assigned}</div>
            </div>
          </div>
        )}

        {/* Manual Add & Upload Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Add Loyalty IDs</h2>
            <button
              onClick={() => {
                setShowManualAdd(true);
                setManualError('');
                setManualLoyaltyId('');
              }}
              className="bg-espro-teal text-white px-4 py-2 rounded-lg font-semibold hover:bg-teal-600"
            >
              + Add Manually
            </button>
          </div>

          {/* Manual Add Form */}
          {showManualAdd && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-md font-semibold mb-3">Add Single Loyalty ID</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualLoyaltyId}
                  onChange={(e) => {
                    setManualLoyaltyId(e.target.value);
                    setManualError('');
                  }}
                  placeholder="Enter loyalty ID (e.g., LYL-0001-0001)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-espro-orange focus:border-transparent"
                />
                <button
                  onClick={() => {
                    if (!manualLoyaltyId.trim()) {
                      setManualError('Please enter a loyalty ID');
                      return;
                    }
                    createLoyaltyIdMutation.mutate(manualLoyaltyId.trim());
                  }}
                  disabled={createLoyaltyIdMutation.isLoading}
                  className="bg-espro-teal text-white px-6 py-2 rounded-lg font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoyaltyIdMutation.isLoading ? 'Adding...' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setShowManualAdd(false);
                    setManualLoyaltyId('');
                    setManualError('');
                  }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
              {manualError && (
                <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {manualError}
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Upload a CSV file with loyalty IDs. The CSV should have the following format:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <code className="text-sm">
                code,partner,partner_email,points<br />
                LYL-0001-0001,John Doe,john@example.com,100.50<br />
                LYL-0001-0002,Jane Smith,jane@example.com,250.00<br />
                LYL-0001-0003,Bob Johnson,bob@example.com,50.25
              </code>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              <strong>Note:</strong> When a customer registers with an email matching <code>partner_email</code>, 
              they will automatically receive the loyalty ID and points from the CSV.
            </p>
          </div>
          <div className="mb-4">
            <input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-espro-orange file:text-white hover:file:bg-orange-600"
            />
            {file && <p className="mt-2 text-sm text-gray-600">Selected: {file.name}</p>}
          </div>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {result && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              <div className="font-semibold mb-1">Upload Successful!</div>
              <div className="text-sm">
                Created: {result.created} IDs
                {result.errors > 0 && (
                  <div className="text-red-600 mt-1">Errors: {result.errors}</div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="bg-espro-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>

        {/* Filter and List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filter === 'all' ? 'bg-espro-orange text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('available')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filter === 'available' ? 'bg-espro-orange text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Available
              </button>
              <button
                onClick={() => setFilter('assigned')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filter === 'assigned' ? 'bg-espro-orange text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Assigned
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading loyalty IDs...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loyalty ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data?.data?.loyaltyIds?.map((id) => (
                      <tr key={id._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-semibold">{id.loyaltyId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{id.partnerName || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{id.partnerEmail || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">{formatEsproCoinsDisplay(id.points || 0)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs ${
                            id.isAssigned ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {id.isAssigned ? 'Assigned' : 'Available'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {id.assignedTo?.name || id.assignedTo?.email || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {id.assignedAt ? new Date(id.assignedAt).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data?.data?.pagination && (
                <div className="p-4 border-t flex justify-between items-center">
                  <div className="text-sm text-gray-700">
                    Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, data.data.pagination.total)} of {data.data.pagination.total} IDs
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
        </div>
      </div>
    </Layout>
  );
}

