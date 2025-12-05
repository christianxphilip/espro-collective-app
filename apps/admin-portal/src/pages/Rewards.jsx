import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rewardsAPI, adminAPI } from '../services/api';
import Layout from '../components/Layout';
import { formatEsproCoinsDisplay } from '../utils/format';
import { getBaseApiUrl } from '../utils/api';

export default function Rewards() {
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    esproCoinsRequired: '',
    quantity: '',
    image: null,
    voucherImage: null,
    voucherCodes: null, // CSV file for voucher codes
    isActive: true,
    claimableAtStore: false, // New: if true, reward is claimable at store (no voucher codes needed)
    voucherUploadRequired: false, // New: if true, voucher codes CSV is required
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [previewVoucherImage, setPreviewVoucherImage] = useState(null);

  const queryClient = useQueryClient();

  const { data: rewardsResponse, isLoading, error } = useQuery({
    queryKey: ['admin-rewards'],
    queryFn: async () => {
      try {
        const res = await adminAPI.getRewards();
        console.log('[Rewards] Full API Response:', res);
        console.log('[Rewards] Response Data:', res.data);
        console.log('[Rewards] Rewards Array:', res.data?.rewards);
        return res.data;
      } catch (err) {
        console.error('[Rewards] API Error:', err);
        console.error('[Rewards] Error Response:', err.response);
        throw err;
      }
    },
  });

  const rewards = rewardsResponse?.rewards || [];
  console.log('[Rewards] Current rewards state:', rewards);

  const createMutation = useMutation({
    mutationFn: (data) => rewardsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rewards']);
      setShowForm(false);
      resetForm();
      alert('Reward created successfully');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to create reward');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => rewardsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rewards']);
      setShowForm(false);
      setEditingReward(null);
      resetForm();
      alert('Reward updated successfully');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to update reward');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => rewardsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['rewards']);
      alert('Reward deleted successfully');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to delete reward');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      esproCoinsRequired: '',
      quantity: '',
      image: null,
      voucherImage: null,
      voucherCodes: null,
      isActive: true,
      claimableAtStore: false,
      voucherUploadRequired: false,
    });
    setPreviewImage(null);
    setPreviewVoucherImage(null);
  };

  const handleEdit = (reward) => {
    setEditingReward(reward);
    const imageUrl = reward.imageUrl 
      ? (reward.imageUrl.startsWith('http') 
          ? reward.imageUrl 
          : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${reward.imageUrl}`)
      : null;
    const voucherImageUrl = reward.voucherImageUrl 
      ? (reward.voucherImageUrl.startsWith('http') 
          ? reward.voucherImageUrl 
          : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${reward.voucherImageUrl}`)
      : null;
    
    setFormData({
      name: reward.title || '',
      description: reward.description || '',
      esproCoinsRequired: reward.esproCoinsRequired || '',
      quantity: reward.quantity === -1 ? '' : reward.quantity,
      image: null,
      voucherImage: null,
      voucherCodes: null,
      isActive: reward.isActive !== undefined ? reward.isActive : true,
      claimableAtStore: reward.claimableAtStore || false,
      voucherUploadRequired: reward.voucherUploadRequired || false,
    });
    setPreviewImage(imageUrl);
    setPreviewVoucherImage(voucherImageUrl);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      quantity: formData.quantity === '' ? -1 : parseInt(formData.quantity),
      esproCoinsRequired: parseInt(formData.esproCoinsRequired),
      isActive: formData.isActive,
      claimableAtStore: formData.claimableAtStore,
      voucherUploadRequired: formData.voucherUploadRequired,
    };

    if (editingReward) {
      updateMutation.mutate({ id: editingReward._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this reward?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Rewards Management</h1>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingReward(null);
              resetForm();
            }}
            className="bg-espro-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600"
          >
            + Create Reward
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading rewards...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">
            Error loading rewards: {error.response?.data?.message || error.message || 'Unknown error'}
            <div className="text-sm text-gray-500 mt-2">Check console for details</div>
          </div>
        ) : rewards && rewards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => {
              const imageUrl = reward.imageUrl 
                ? (reward.imageUrl.startsWith('http') 
                    ? reward.imageUrl 
                    : `${getBaseApiUrl()}${reward.imageUrl}`)
                : null;
              
              return (
              <div key={reward._id} className="bg-white rounded-lg shadow overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt={reward.title} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">No Image</div>
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-2">{reward.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{reward.description}</p>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-espro-orange font-bold">{formatEsproCoinsDisplay(reward.esproCoinsRequired)} coins</span>
                    <span className={`px-2 py-1 rounded text-xs ${reward.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {reward.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {/* Voucher Count Display */}
                  {reward.hasVoucherCodes !== undefined && (
                    <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">Voucher Status</div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">
                          Available: <span className={reward.availableVouchers === 0 ? 'text-red-600' : 'text-green-600'}>{reward.availableVouchers === -1 ? 'Unlimited' : reward.availableVouchers}</span>
                        </span>
                        {reward.totalVouchers > 0 && (
                          <span className="text-xs text-gray-500">
                            {reward.usedVouchers}/{reward.totalVouchers} used
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(reward)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(reward._id)}
                      className="flex-1 bg-red-100 text-red-700 py-2 rounded-lg font-medium hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No rewards found. Create your first reward!</div>
        )}

        {/* Create/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">{editingReward ? 'Edit Reward' : 'Create Reward'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reward Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Espro Coins Required</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.esproCoinsRequired}
                    onChange={(e) => setFormData({ ...formData, esproCoinsRequired: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.claimableAtStore}
                      onChange={(e) => setFormData({ ...formData, claimableAtStore: e.target.checked, voucherUploadRequired: e.target.checked ? false : formData.voucherUploadRequired })}
                    />
                    <span className="text-sm font-medium text-gray-700">Claimable at Store (No voucher codes needed)</span>
                  </label>
                  {!formData.claimableAtStore && (
                    <>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={formData.voucherUploadRequired}
                          onChange={(e) => setFormData({ ...formData, voucherUploadRequired: e.target.checked })}
                        />
                        <span className="text-sm font-medium text-gray-700">Require Voucher Codes CSV</span>
                      </label>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Upload Voucher Codes (CSV) {formData.voucherUploadRequired && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="file"
                        accept=".csv"
                        required={formData.voucherUploadRequired && !editingReward}
                        onChange={(e) => setFormData({ ...formData, voucherCodes: e.target.files[0] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        CSV format: One voucher code per line. Column header: "code" or "Code" or "voucher_code"
                      </p>
                      {editingReward && (
                        <p className="text-xs text-blue-600 mt-1">
                          Leave empty to keep existing voucher codes. Upload new CSV to add more codes.
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reward Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setFormData({ ...formData, image: file });
                          setPreviewImage(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    {previewImage && (
                      <div className="mt-3">
                        <img 
                          src={previewImage} 
                          alt="Preview" 
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewImage(null);
                            setFormData({ ...formData, image: null });
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-700"
                        >
                          Remove image
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setFormData({ ...formData, voucherImage: file });
                          setPreviewVoucherImage(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    {previewVoucherImage && (
                      <div className="mt-3">
                        <img 
                          src={previewVoucherImage} 
                          alt="Preview" 
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewVoucherImage(null);
                            setFormData({ ...formData, voucherImage: null });
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-700"
                        >
                          Remove image
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createMutation.isLoading || updateMutation.isLoading}
                    className="flex-1 bg-espro-orange text-white py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
                  >
                    {createMutation.isLoading || updateMutation.isLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingReward(null);
                      resetForm();
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

