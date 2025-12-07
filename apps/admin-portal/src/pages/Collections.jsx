import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectiblesAPI, aiAPI } from '../services/api';
import Layout from '../components/Layout';
import { getBaseApiUrl } from '../utils/api';
import { formatEsproCoinsDisplay } from '../utils/format';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

export default function Collections() {
  const [showForm, setShowForm] = useState(false);
  const [editingCollectible, setEditingCollectible] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewBackImage, setPreviewBackImage] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    lifetimeEsproCoinsRequired: '0',
    designType: 'gradient',
    primaryColor: '#f66633',
    secondaryColor: '#ff8c64',
    textColor: '#FFFFFF',
    image: null,
    backCardColor: '',
    backCardImage: null,
    isDefault: false,
    isActive: true,
  });

  const queryClient = useQueryClient();

  const { data: collectibles, isLoading } = useQuery({
    queryKey: ['collectibles'],
    queryFn: () => collectiblesAPI.getAll().then((res) => res.data.collectibles),
  });

  const createMutation = useMutation({
    mutationFn: (data) => collectiblesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['collectibles']);
      setShowForm(false);
      resetForm();
      setToast({
        isOpen: true,
        message: 'Card design created successfully',
        type: 'success',
      });
    },
    onError: (error) => {
      setToast({
        isOpen: true,
        message: error.response?.data?.message || 'Failed to create card design',
        type: 'error',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => collectiblesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['collectibles']);
      setShowForm(false);
      setEditingCollectible(null);
      resetForm();
      setToast({
        isOpen: true,
        message: 'Card design updated successfully',
        type: 'success',
      });
    },
    onError: (error) => {
      setToast({
        isOpen: true,
        message: error.response?.data?.message || 'Failed to update card design',
        type: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => collectiblesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['collectibles']);
      setToast({
        isOpen: true,
        message: 'Card design deleted successfully',
        type: 'success',
      });
    },
    onError: (error) => {
      setToast({
        isOpen: true,
        message: error.response?.data?.message || 'Failed to delete card design',
        type: 'error',
      });
    },
  });

  const [generatingColors, setGeneratingColors] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [aiGeneratedImageUrl, setAiGeneratedImageUrl] = useState(null);
  const [cardDimensions, setCardDimensions] = useState(null);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collectibleToDelete, setCollectibleToDelete] = useState(null);

  // Fetch card dimensions on component mount
  useEffect(() => {
    aiAPI.getCardDimensions()
      .then((res) => {
        if (res.data.success) {
          setCardDimensions(res.data.dimensions);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch card dimensions:', err);
        // Set default dimensions if API fails
        setCardDimensions({
          width: 428,
          height: 380,
          aspectRatio: '1.126:1',
          description: '428x380 pixels',
        });
      });
  }, []);

  const handleGenerateColors = async () => {
    setGeneratingColors(true);
    try {
      const response = await aiAPI.generateColors(formData.primaryColor || null);
      const { primary, secondary } = response.data.palette;
      setFormData({
        ...formData,
        primaryColor: primary,
        secondaryColor: secondary,
        designType: 'gradient',
      });
      setToast({
        isOpen: true,
        message: `Generated ${response.data.palette.paletteType} color palette!`,
        type: 'success',
      });
    } catch (error) {
      setToast({
        isOpen: true,
        message: error.response?.data?.message || 'Failed to generate colors',
        type: 'error',
      });
    } finally {
      setGeneratingColors(false);
    }
  };

  const handleGenerateImageClick = () => {
    setShowImagePrompt(true);
    setImagePrompt('');
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      setToast({
        isOpen: true,
        message: 'Please enter a description for the image',
        type: 'error',
      });
      return;
    }

    setGeneratingImage(true);
    setShowImagePrompt(false);
    try {
      const response = await aiAPI.generateImage(imagePrompt.trim(), 'modern');
      const { imageUrl } = response.data;
      
      if (imageUrl) {
        // Full image generation succeeded
        const fullImageUrl = imageUrl.startsWith('http') 
          ? imageUrl 
          : `${getBaseApiUrl()}${imageUrl}`;
        
        setFormData({
          ...formData,
          designType: 'image',
          image: null, // Will use the imageUrl from backend
        });
        setPreviewImage(fullImageUrl);
        setAiGeneratedImageUrl(imageUrl); // Store the relative path for submission
        setToast({
          isOpen: true,
          message: 'AI image generated successfully!',
          type: 'success',
        });
      } else if (response.data.gradientColors) {
        // Fallback to gradient if image generation not available
        setFormData({
          ...formData,
          primaryColor: response.data.gradientColors.primary,
          secondaryColor: response.data.gradientColors.secondary,
          designType: 'gradient',
        });
        setPreviewImage(null);
        setAiGeneratedImageUrl(null);
        setToast({
          isOpen: true,
          message: response.data.note || 'Using gradient colors (AI image generation requires OpenAI API key)',
          type: 'success',
        });
      } else {
        setToast({
          isOpen: true,
          message: 'Image generation failed. Please try again.',
          type: 'error',
        });
      }
    } catch (error) {
      setToast({
        isOpen: true,
        message: error.response?.data?.message || 'Failed to generate image',
        type: 'error',
      });
    } finally {
      setGeneratingImage(false);
      setImagePrompt('');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      lifetimeEsproCoinsRequired: '0',
      designType: 'gradient',
      primaryColor: '#f66633',
      secondaryColor: '#ff8c64',
      textColor: '#FFFFFF',
      image: null,
      backCardColor: '',
      backCardImage: null,
      isDefault: false,
      isActive: true,
    });
    setPreviewImage(null);
    setPreviewBackImage(null);
    setAiGeneratedImageUrl(null);
  };

  const handleEdit = (collectible) => {
    setEditingCollectible(collectible);
    const imageUrl = collectible.imageUrl 
      ? (collectible.imageUrl.startsWith('http') 
          ? collectible.imageUrl 
          : `${getBaseApiUrl()}${collectible.imageUrl}`)
      : null;
    
    const backImageUrl = collectible.backCardImageUrl 
      ? (collectible.backCardImageUrl.startsWith('http') 
          ? collectible.backCardImageUrl 
          : `${getBaseApiUrl()}${collectible.backCardImageUrl}`)
      : null;
    
    setFormData({
      name: collectible.name || '',
      description: collectible.description || '',
      lifetimeEsproCoinsRequired: collectible.lifetimeEsproCoinsRequired || '0',
      designType: collectible.designType || 'gradient',
      primaryColor: collectible.designType === 'solid' 
        ? (collectible.solidColor || '#f66633')
        : (collectible.gradientColors?.primary || '#f66633'),
      secondaryColor: collectible.gradientColors?.secondary || '#ff8c64',
      textColor: collectible.textColor || '#FFFFFF',
      image: null,
      backCardColor: collectible.backCardColor || '',
      backCardImage: null,
      isDefault: collectible.isDefault || false,
      isActive: collectible.isActive !== undefined ? collectible.isActive : true,
    });
    setPreviewImage(imageUrl);
    setPreviewBackImage(backImageUrl);
    setAiGeneratedImageUrl(collectible.imageUrl && !imageUrl.startsWith('http') ? collectible.imageUrl : null);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formDataToSend = new FormData();
    
    console.log('[Collections] Form submission:', {
      designType: formData.designType,
      hasImage: !!formData.image,
      imageName: formData.image?.name,
      hasAiImage: !!aiGeneratedImageUrl,
      aiImageUrl: aiGeneratedImageUrl
    });
    
    // Add all form fields
    formDataToSend.append('name', formData.name);
    formDataToSend.append('description', formData.description || '');
    formDataToSend.append('lifetimeEsproCoinsRequired', formData.lifetimeEsproCoinsRequired);
    formDataToSend.append('designType', formData.designType);
    formDataToSend.append('textColor', formData.textColor);
    formDataToSend.append('isActive', formData.isActive);
    formDataToSend.append('isDefault', formData.isDefault);
    
    // Handle design-specific fields based on designType
    if (formData.designType === 'reward') {
      // For reward type, we still need gradient colors for display, and can have images
      formDataToSend.append('primaryColor', formData.primaryColor);
      formDataToSend.append('secondaryColor', formData.secondaryColor);
      
      // Add front image if provided
      if (formData.image) {
        console.log('[Collections] Adding image file to FormData:', {
          name: formData.image.name,
          type: formData.image.type,
          size: formData.image.size,
          isFile: formData.image instanceof File
        });
        formDataToSend.append('image', formData.image);
        // Verify it was added
        console.log('[Collections] FormData entries after adding image:', Array.from(formDataToSend.entries()).map(([key, value]) => [key, value instanceof File ? `File: ${value.name}` : value]));
      } else if (aiGeneratedImageUrl && !formData.image) {
        console.log('[Collections] Adding AI-generated image URL to FormData:', aiGeneratedImageUrl);
        formDataToSend.append('imageUrl', aiGeneratedImageUrl);
      } else {
        console.log('[Collections] No image provided for reward type', {
          hasFormDataImage: !!formData.image,
          hasAiImage: !!aiGeneratedImageUrl,
          formDataKeys: Object.keys(formData)
        });
      }
      
      // Add back card data - always send it, even if empty (to clear it)
      formDataToSend.append('backCardColor', formData.backCardColor || '');
      
      // Add back card image
      if (formData.backCardImage) {
        console.log('[Collections] Adding back card image file to FormData:', formData.backCardImage.name);
        formDataToSend.append('backCardImage', formData.backCardImage);
      }
    } else if (formData.designType === 'gradient') {
      formDataToSend.append('primaryColor', formData.primaryColor);
      formDataToSend.append('secondaryColor', formData.secondaryColor);
      
      // Add back card data - always send it, even if empty (to clear it)
      formDataToSend.append('backCardColor', formData.backCardColor || '');
      
      // Add back card image
      if (formData.backCardImage) {
        formDataToSend.append('backCardImage', formData.backCardImage);
      }
    } else if (formData.designType === 'solid') {
      formDataToSend.append('solidColor', formData.primaryColor);
      
      // Add back card data - always send it, even if empty (to clear it)
      formDataToSend.append('backCardColor', formData.backCardColor || '');
      
      // Add back card image
      if (formData.backCardImage) {
        formDataToSend.append('backCardImage', formData.backCardImage);
      }
    } else if (formData.designType === 'image') {
      // Add front image
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      } else if (aiGeneratedImageUrl && !formData.image) {
        formDataToSend.append('imageUrl', aiGeneratedImageUrl);
      }
      
      // Add back card data - always send it, even if empty (to clear it)
      formDataToSend.append('backCardColor', formData.backCardColor || '');
      
      // Add back card image
      if (formData.backCardImage) {
        formDataToSend.append('backCardImage', formData.backCardImage);
      }
    }

    // Log all FormData entries before submission
    console.log('[Collections] FormData entries before submission:', 
      Array.from(formDataToSend.entries()).map(([key, value]) => [
        key, 
        value instanceof File 
          ? `File: ${value.name} (${value.size} bytes, ${value.type})` 
          : typeof value === 'object' 
            ? JSON.stringify(value) 
            : value
      ])
    );

    if (editingCollectible) {
      updateMutation.mutate({ id: editingCollectible._id, data: formDataToSend });
    } else {
      createMutation.mutate(formDataToSend);
    }
  };

  const handleDelete = (id) => {
    setCollectibleToDelete(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (collectibleToDelete) {
      deleteMutation.mutate(collectibleToDelete);
      setShowDeleteConfirm(false);
      setCollectibleToDelete(null);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Card Designs Management</h1>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingCollectible(null);
              resetForm();
            }}
            className="bg-espro-orange text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600"
          >
            + Create Card Design
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading card designs...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collectibles?.map((collectible) => {
              // Construct full image URL
              const imageUrl = collectible.imageUrl 
                ? (collectible.imageUrl.startsWith('http') 
                    ? collectible.imageUrl 
                    : `${getBaseApiUrl()}${collectible.imageUrl}`)
                : null;
              
              const cardStyle =
                collectible.designType === 'image' && imageUrl
                  ? {
                      backgroundImage: `url(${imageUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }
                  : collectible.designType === 'solid' && collectible.solidColor
                  ? {
                      background: collectible.solidColor,
                    }
                  : {
                      background: `linear-gradient(135deg, ${collectible.gradientColors?.primary || '#f66633'} 0%, ${collectible.gradientColors?.secondary || '#ff8c64'} 100%)`,
                    };

              const textColor = collectible.textColor || '#FFFFFF';

              return (
                <div key={collectible._id} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="h-32 p-4" style={{ ...cardStyle, color: textColor }}>
                    <div className="text-xs opacity-90" style={{ color: textColor }}>ESPRO</div>
                    <div className="text-xl font-bold mt-1" style={{ color: textColor }}>1,250</div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-1">{collectible.name}</h3>
                    {collectible.description && (
                      <p className="text-sm text-gray-600 mb-2">{collectible.description}</p>
                    )}
                    <div className="flex justify-between items-center mb-3">
                      {collectible.designType === 'reward' ? (
                        <span className="text-xs text-gray-500">
                          Unlocks via rewards
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          Unlocks at {formatEsproCoinsDisplay(collectible.lifetimeEsproCoinsRequired)} total earned espro coins
                        </span>
                      )}
                      {collectible.isDefault && (
                        <span className="px-2 py-1 bg-espro-orange text-white text-xs rounded">Default</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(collectible)}
                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(collectible._id)}
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
              <h2 className="text-2xl font-bold mb-4">{editingCollectible ? 'Edit Card Design' : 'Create Card Design'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Design Name</label>
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
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Design Type</label>
                  <select
                    value={formData.designType}
                    onChange={(e) => {
                      const newDesignType = e.target.value;
                      setFormData({ 
                        ...formData, 
                        designType: newDesignType,
                        // Reset lifetimeEsproCoinsRequired to 0 if reward type
                        lifetimeEsproCoinsRequired: newDesignType === 'reward' ? '0' : formData.lifetimeEsproCoinsRequired
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="gradient">Gradient</option>
                    <option value="solid">Solid</option>
                    <option value="image">Image</option>
                    <option value="reward">Reward (Unlocked via rewards)</option>
                  </select>
                  {formData.designType === 'reward' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Reward-type designs are unlocked by claiming rewards, not by earning coins
                    </p>
                  )}
                </div>
                {formData.designType !== 'reward' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Earned Espro Coins Required</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.lifetimeEsproCoinsRequired}
                      onChange={(e) => setFormData({ ...formData, lifetimeEsproCoinsRequired: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                )}
                {formData.designType === 'gradient' ? (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Gradient Colors</label>
                      <button
                        type="button"
                        onClick={handleGenerateColors}
                        disabled={generatingColors}
                        className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-medium hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1"
                      >
                        {generatingColors ? (
                          <>
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            Generate with AI
                          </>
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={formData.primaryColor}
                            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                            className="h-10 w-20 border border-gray-300 rounded"
                          />
                          <input
                            type="text"
                            value={formData.primaryColor}
                            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={formData.secondaryColor}
                            onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                            className="h-10 w-20 border border-gray-300 rounded"
                          />
                          <input
                            type="text"
                            value={formData.secondaryColor}
                            onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Preview */}
                    <div className="mt-3 p-3 rounded-lg border border-gray-200" style={{
                      background: `linear-gradient(135deg, ${formData.primaryColor} 0%, ${formData.secondaryColor} 100%)`,
                      minHeight: '60px',
                      color: formData.textColor,
                    }}>
                      <div className="text-xs opacity-80" style={{ color: formData.textColor }}>Preview</div>
                    </div>
                  </div>
                ) : formData.designType === 'solid' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Solid Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="h-10 w-20 border border-gray-300 rounded"
                      />
                      <input
                        type="text"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    {/* Preview */}
                    <div className="mt-3 p-3 rounded-lg border border-gray-200" style={{
                      background: formData.primaryColor,
                      minHeight: '60px',
                      color: formData.textColor,
                    }}>
                      <div className="text-xs opacity-80" style={{ color: formData.textColor }}>Preview</div>
                    </div>
                  </div>
                ) : formData.designType === 'reward' ? (
                  <div>
                    {/* For reward type, show gradient colors and image upload */}
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Gradient Colors</label>
                      <button
                        type="button"
                        onClick={handleGenerateColors}
                        disabled={generatingColors}
                        className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-medium hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1"
                      >
                        {generatingColors ? (
                          <>
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            Generate with AI
                          </>
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={formData.primaryColor}
                            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                            className="h-10 w-20 border border-gray-300 rounded"
                          />
                          <input
                            type="text"
                            value={formData.primaryColor}
                            onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={formData.secondaryColor}
                            onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                            className="h-10 w-20 border border-gray-300 rounded"
                          />
                          <input
                            type="text"
                            value={formData.secondaryColor}
                            onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Preview */}
                    <div className="mt-3 p-3 rounded-lg border border-gray-200" style={{
                      background: `linear-gradient(135deg, ${formData.primaryColor} 0%, ${formData.secondaryColor} 100%)`,
                      minHeight: '60px',
                      color: formData.textColor,
                    }}>
                      <div className="text-xs opacity-80" style={{ color: formData.textColor }}>Preview</div>
                    </div>
                    
                    {/* Image upload for reward type */}
                    {cardDimensions && (
                      <div className="mt-4 mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-blue-600">📐</span>
                          <span className="text-sm font-semibold text-blue-900">Required Card Dimensions</span>
                        </div>
                        <div className="text-xs text-blue-700">
                          <div className="font-mono font-semibold">{cardDimensions.width} × {cardDimensions.height} pixels</div>
                          <div className="mt-1">Aspect Ratio: {cardDimensions.aspectRatio}</div>
                          <div className="text-blue-600 mt-1">{cardDimensions.description}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center mb-2 mt-4">
                      <label className="block text-sm font-medium text-gray-700">Card Design Image (Optional)</label>
                      <button
                        type="button"
                        onClick={handleGenerateImageClick}
                        disabled={generatingImage}
                        className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-medium hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1"
                      >
                        {generatingImage ? (
                          <>
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <span>🎨</span>
                            Generate with AI
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="file"
                      accept="image/*,.svg"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setFormData({ ...formData, image: file });
                          setPreviewImage(URL.createObjectURL(file));
                          setAiGeneratedImageUrl(null); // Clear AI image if user uploads
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
                            setAiGeneratedImageUrl(null);
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-700"
                        >
                          Remove image
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Upload an image file (optional). Image will be automatically resized to {cardDimensions ? `${cardDimensions.width}×${cardDimensions.height}px` : '428×380px'}.
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Card Dimensions Info */}
                    {cardDimensions && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-blue-600">📐</span>
                          <span className="text-sm font-semibold text-blue-900">Required Card Dimensions</span>
                        </div>
                        <div className="text-xs text-blue-700">
                          <div className="font-mono font-semibold">{cardDimensions.width} × {cardDimensions.height} pixels</div>
                          <div className="mt-1">Aspect Ratio: {cardDimensions.aspectRatio}</div>
                          <div className="text-blue-600 mt-1">{cardDimensions.description}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Card Design Image</label>
                      <button
                        type="button"
                        onClick={handleGenerateImageClick}
                        disabled={generatingImage}
                        className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-lg font-medium hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1"
                      >
                        {generatingImage ? (
                          <>
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <span>🎨</span>
                            Generate with AI
                          </>
                        )}
                      </button>
                    </div>
                    <input
                      type="file"
                      accept="image/*,.svg"
                      required={!editingCollectible && !previewImage && !aiGeneratedImageUrl}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setFormData({ ...formData, image: file });
                          setPreviewImage(URL.createObjectURL(file));
                          setAiGeneratedImageUrl(null); // Clear AI image if user uploads
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
                            setAiGeneratedImageUrl(null);
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-700"
                        >
                          Remove image
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Upload an image file. Image will be automatically resized to {cardDimensions ? `${cardDimensions.width}×${cardDimensions.height}px` : '428×380px'}.
                    </p>
                  </div>
                )}
                {/* Text Color Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.textColor}
                      onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                      className="h-10 w-20 border border-gray-300 rounded"
                    />
                    <input
                      type="text"
                      value={formData.textColor}
                      onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="#FFFFFF"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Color for text displayed on the card (ESPRO, Balance, Loyalty ID)</p>
                </div>

                {/* Back Card Design Section */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Back Card Design</h3>
                  <p className="text-xs text-gray-500 mb-3">Configure the design for the back of the card (shown when flipped)</p>
                  
                  <div className="space-y-4">
                    {/* Back Card Color Option */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Back Card Color (Optional)</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.backCardColor || '#f66633'}
                          onChange={(e) => setFormData({ ...formData, backCardColor: e.target.value, backCardImage: null })}
                          className="h-10 w-20 border border-gray-300 rounded"
                        />
                        <input
                          type="text"
                          value={formData.backCardColor}
                          onChange={(e) => setFormData({ ...formData, backCardColor: e.target.value, backCardImage: null })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="#f66633"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Leave empty to use front card design</p>
                    </div>

                    {/* Back Card Image Option */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Back Card Image (Optional)</label>
                      <input
                        type="file"
                        accept="image/*,.svg"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            setFormData({ ...formData, backCardImage: file, backCardColor: '' });
                            setPreviewBackImage(URL.createObjectURL(file));
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      {previewBackImage && (
                        <div className="mt-3">
                          <img 
                            src={previewBackImage} 
                            alt="Back Card Preview" 
                            className="w-full h-32 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewBackImage(null);
                              setFormData({ ...formData, backCardImage: null });
                            }}
                            className="mt-2 text-xs text-red-600 hover:text-red-700"
                          >
                            Remove back image
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Upload an image for the back of the card. If both color and image are provided, image takes priority.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-gray-700">Set as Default Design</span>
                  </label>
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
                      setEditingCollectible(null);
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

        {/* AI Image Generation Prompt Modal */}
        {showImagePrompt && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowImagePrompt(false)}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4">Generate AI Image</h3>
              <p className="text-sm text-gray-600 mb-4">
                Describe the card design you want to generate:
              </p>
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder='e.g., "Modern orange gradient card with geometric patterns" or "Elegant teal card with abstract shapes"'
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={generatingImage || !imagePrompt.trim()}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
                >
                  {generatingImage ? 'Generating...' : 'Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowImagePrompt(false);
                    setImagePrompt('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        <Toast
          isOpen={toast.isOpen}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, isOpen: false })}
        />

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setCollectibleToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Delete Card Design"
          message="Are you sure you want to delete this card design? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          isLoading={deleteMutation.isLoading}
        />
      </div>
    </Layout>
  );
}

