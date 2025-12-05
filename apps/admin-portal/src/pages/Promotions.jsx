import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promotionsAPI } from '../services/api';
import Layout from '../components/Layout';
import { getBaseApiUrl } from '../utils/api';

export default function Promotions() {
  const [showForm, setShowForm] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    linkUrl: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    image: null,
    isActive: true,
  });

  const queryClient = useQueryClient();

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: () => promotionsAPI.getAll().then((res) => res.data.promotions),
  });

  const createMutation = useMutation({
    mutationFn: (data) => promotionsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['promotions']);
      setShowForm(false);
      resetForm();
      alert('Promotion created successfully');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to create promotion');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => promotionsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['promotions']);
      setShowForm(false);
      setEditingPromotion(null);
      resetForm();
      alert('Promotion updated successfully');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to update promotion');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => promotionsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['promotions']);
      alert('Promotion deleted successfully');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to delete promotion');
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      linkUrl: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      image: null,
      isActive: true,
    });
    setPreviewImage(null);
  };

  const handleEdit = (promotion) => {
    setEditingPromotion(promotion);
    const imageUrl = promotion.imageUrl 
      ? (promotion.imageUrl.startsWith('http') 
          ? promotion.imageUrl 
          : `${getBaseApiUrl()}${promotion.imageUrl}`)
      : null;
    
    setFormData({
      title: promotion.title || '',
      description: promotion.description || '',
      linkUrl: promotion.linkUrl || '',
      startDate: promotion.startDate ? new Date(promotion.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: promotion.endDate ? new Date(promotion.endDate).toISOString().split('T')[0] : '',
      image: null,
      isActive: promotion.isActive !== undefined ? promotion.isActive : true,
    });
    setPreviewImage(imageUrl);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      isActive: formData.isActive,
    };

    if (editingPromotion) {
      updateMutation.mutate({ id: editingPromotion._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this promotion?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Promotions Management</h1>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingPromotion(null);
              resetForm();
            }}
            className="bg-espro-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600"
          >
            + Create Promotion
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading promotions...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promotions?.map((promotion) => {
              // Construct full image URL
              const imageUrl = promotion.imageUrl 
                ? (promotion.imageUrl.startsWith('http') 
                    ? promotion.imageUrl 
                    : `${getBaseApiUrl()}${promotion.imageUrl}`)
                : null;
              
              return (
              <div key={promotion._id} className="bg-white rounded-lg shadow overflow-hidden">
                {imageUrl && (
                  <img src={imageUrl} alt={promotion.title} className="w-full h-48 object-cover" />
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-2">{promotion.title}</h3>
                  {promotion.description && (
                    <p className="text-sm text-gray-600 mb-3">{promotion.description}</p>
                  )}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-500">
                      {new Date(promotion.startDate).toLocaleDateString()}
                      {promotion.endDate && ` - ${new Date(promotion.endDate).toLocaleDateString()}`}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${promotion.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {promotion.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(promotion)}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(promotion._id)}
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
        )}

        {/* Create/Edit Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">{editingPromotion ? 'Edit Promotion' : 'Create Promotion'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link URL (optional)</label>
                  <input
                    type="url"
                    value={formData.linkUrl}
                    onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Promotion Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    required={!editingPromotion && !previewImage}
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
                        className="w-full h-48 object-cover rounded-lg border border-gray-200"
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
                      setEditingPromotion(null);
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

