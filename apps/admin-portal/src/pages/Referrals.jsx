import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { referralsAPI, collectiblesAPI, rewardsAPI } from '../services/api';
import Layout from '../components/Layout';

export default function Referrals() {
  const [showForm, setShowForm] = useState(false);
  const [editingReferral, setEditingReferral] = useState(null);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [viewingReferral, setViewingReferral] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    assignedCardDesign: '',
    assignedReward: '',
    maxUses: '',
    isActive: true,
  });

  const queryClient = useQueryClient();

  const { data: referralsResponse, isLoading, error } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => referralsAPI.getAll().then((res) => res.data.referrals),
  });

  const referrals = referralsResponse || [];

  // Fetch collectibles and rewards for dropdowns
  const { data: collectiblesResponse } = useQuery({
    queryKey: ['collectibles'],
    queryFn: () => collectiblesAPI.getAll().then((res) => res.data.collectibles),
  });

  const { data: rewardsResponse } = useQuery({
    queryKey: ['admin-rewards'],
    queryFn: () => rewardsAPI.getAll().then((res) => res.data.rewards || []),
  });

  const collectibles = collectiblesResponse || [];
  const rewards = rewardsResponse || [];

  const createMutation = useMutation({
    mutationFn: (data) => referralsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['referrals']);
      setShowForm(false);
      resetForm();
      alert('Referral code created successfully');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to create referral code');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => referralsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['referrals']);
      setShowForm(false);
      setEditingReferral(null);
      resetForm();
      alert('Referral code updated successfully');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to update referral code');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => referralsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['referrals']);
      alert('Referral code deactivated successfully');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to deactivate referral code');
    },
  });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['referral-users', viewingReferral?._id],
    queryFn: () => referralsAPI.getUsers(viewingReferral._id).then((res) => res.data),
    enabled: !!viewingReferral && showUsersModal,
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      assignedCardDesign: '',
      assignedReward: '',
      maxUses: '',
      isActive: true,
    });
  };

  const handleEdit = (referral) => {
    setEditingReferral(referral);
    setFormData({
      code: referral.code,
      name: referral.name || '',
      description: referral.description || '',
      assignedCardDesign: referral.assignedCardDesign?._id || '',
      assignedReward: referral.assignedReward?._id || '',
      maxUses: referral.maxUses === -1 ? '' : referral.maxUses,
      isActive: referral.isActive !== undefined ? referral.isActive : true,
    });
    setShowForm(true);
  };

  const handleViewUsers = async (referral) => {
    setViewingReferral(referral);
    setShowUsersModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      maxUses: formData.maxUses === '' ? -1 : parseInt(formData.maxUses),
      assignedCardDesign: formData.assignedCardDesign || null,
      assignedReward: formData.assignedReward || null,
    };

    if (editingReferral) {
      updateMutation.mutate({ id: editingReferral._id, data });
    } else {
      // Only send code if manually entered
      if (!data.code) {
        delete data.code; // Let backend auto-generate
      }
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to deactivate this referral code?')) {
      deleteMutation.mutate(id);
    }
  };

  const generateCode = () => {
    const prefix = formData.name ? formData.name.toUpperCase().substring(0, 4).replace(/\s/g, '') : 'CLUB';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const part1 = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const part2 = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    setFormData({ ...formData, code: `${prefix}-${part1}-${part2}` });
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Referral Management</h1>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingReferral(null);
              resetForm();
            }}
            className="bg-espro-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600"
          >
            + Create Referral Code
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading referral codes...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">
            Error loading referral codes: {error.response?.data?.message || error.message}
          </div>
        ) : referrals && referrals.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Card Design</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {referrals.map((referral) => (
                  <tr key={referral._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono font-semibold text-gray-900">{referral.code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{referral.name}</div>
                      {referral.description && (
                        <div className="text-sm text-gray-500">{referral.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {referral.assignedCardDesign ? (
                        <div className="text-sm text-gray-900">{referral.assignedCardDesign.name}</div>
                      ) : (
                        <span className="text-sm text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {referral.assignedReward ? (
                        <div className="text-sm text-gray-900">{referral.assignedReward.title}</div>
                      ) : (
                        <span className="text-sm text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {referral.currentUses} / {referral.maxUses === -1 ? '∞' : referral.maxUses}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        referral.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {referral.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewUsers(referral)}
                          className="text-espro-orange hover:text-orange-600"
                        >
                          View Users
                        </button>
                        <button
                          onClick={() => handleEdit(referral)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(referral._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No referral codes found. Create your first referral code!</div>
        )}

        {/* Create/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">{editingReferral ? 'Edit Referral Code' : 'Create Referral Code'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referral Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder={editingReferral ? 'Code cannot be changed' : 'Leave empty to auto-generate'}
                      disabled={!!editingReferral}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    />
                    {!editingReferral && (
                      <button
                        type="button"
                        onClick={generateCode}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Generate
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {editingReferral ? 'Code cannot be changed after creation' : 'Leave empty to auto-generate or enter manually'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name (Club Name)</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Pokemon Club"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Card Design</label>
                  <select
                    value={formData.assignedCardDesign}
                    onChange={(e) => setFormData({ ...formData, assignedCardDesign: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">None</option>
                    {collectibles.map((collectible) => (
                      <option key={collectible._id} value={collectible._id}>
                        {collectible.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Reward</label>
                  <select
                    value={formData.assignedReward}
                    onChange={(e) => setFormData({ ...formData, assignedReward: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">None</option>
                    {rewards.map((reward) => (
                      <option key={reward._id} value={reward._id}>
                        {reward.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses</label>
                  <input
                    type="number"
                    value={formData.maxUses}
                    onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                    placeholder="Leave empty for unlimited"
                    min="-1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty or set to -1 for unlimited uses</p>
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

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={createMutation.isLoading || updateMutation.isLoading}
                    className="flex-1 bg-espro-orange text-white py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
                  >
                    {createMutation.isLoading || updateMutation.isLoading ? 'Saving...' : editingReferral ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingReferral(null);
                      resetForm();
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Users Modal */}
        {showUsersModal && viewingReferral && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowUsersModal(false)}>
            <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Users who used: {viewingReferral.code}</h2>
                <button
                  onClick={() => setShowUsersModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {isLoadingUsers ? (
                <div className="text-center py-8 text-gray-500">Loading users...</div>
              ) : usersData && usersData.users && usersData.users.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600 mb-4">
                    Total users: {usersData.total || usersData.users.length}
                  </div>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loyalty ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used At</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {usersData.users.map((entry, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {entry.user?.name || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {entry.user?.email || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {entry.user?.loyaltyId || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {entry.usedAt ? new Date(entry.usedAt).toLocaleString() : 'N/A'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No users have used this referral code yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

