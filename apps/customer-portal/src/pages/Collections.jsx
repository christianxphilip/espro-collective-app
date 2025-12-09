import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { formatEsproCoinsDisplay } from '../utils/format';
import { getBaseApiUrl } from '../utils/api';
import Toast from '../components/Toast';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

export default function Collections() {
  const { user, updateUser, fetchUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCardFlipped, setActiveCardFlipped] = useState(false);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });
  const [activatingCardId, setActivatingCardId] = useState(null); // Track which card is being activated

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh(
    [['collectibles']],
    async () => {
      await fetchUser();
    }
  );

  const { data: collectibles, isLoading: isLoadingCollectibles, error: collectiblesError } = useQuery({
    queryKey: ['collectibles'],
    queryFn: async () => {
      try {
        const res = await customerAPI.getCollectibles();
        console.log('[Collections] API Response:', res.data);
        return res.data.collectibles || [];
      } catch (err) {
        console.error('[Collections] API Error:', err);
        throw err;
      }
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id) => {
      setActivatingCardId(id); // Set loading state immediately
      return customerAPI.activateCardDesign(id);
    },
    onSuccess: async (data) => {
      // Update user with the full activeCardDesign object from the response
      updateUser({ activeCardDesign: data.data.user.activeCardDesign });
      // Also refetch user to ensure we have the latest data
      await fetchUser();
      queryClient.invalidateQueries(['profile']);
      queryClient.invalidateQueries(['collectibles']);
      setActivatingCardId(null); // Clear loading state
      setToast({
        isOpen: true,
        message: 'Card design activated!',
        type: 'success',
      });
    },
    onError: (error) => {
      setActivatingCardId(null); // Clear loading state on error
      setToast({
        isOpen: true,
        message: error.response?.data?.message || 'Failed to activate card design',
        type: 'error',
      });
    },
  });

  const activeDesignId = user?.activeCardDesign?._id || user?.activeCardDesign;

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Pull to Refresh Indicator */}
      {(isRefreshing || pullDistance > 0) && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-espro-orange text-white py-3 transition-all duration-200"
          style={{
            transform: `translateY(${Math.max(0, pullDistance - 60)}px)`,
            opacity: isRefreshing ? 1 : Math.min(1, pullDistance / 60),
          }}
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span>Pull to refresh</span>
            </>
          )}
        </div>
      )}
      
      {/* Header */}
      <div className="bg-transparent px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="font-bold text-xl text-gray-900">Card Designs</div>
            <div className="text-sm text-gray-600">Unlock new card styles</div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-gray-900">{formatEsproCoinsDisplay(user?.lifetimeEsproCoins || 0)}</div>
          <div className="text-sm text-gray-600">Total Earned Espro Coins</div>
        </div>

        {/* Currently Active Card */}
        {activeDesignId && collectibles && (
          <div className="mb-6 w-full">
            <div className="text-sm text-gray-600 mb-3 font-medium">Currently Active</div>
            {(() => {
              const activeDesign = collectibles.find((c) => c._id === activeDesignId);
              if (!activeDesign) return null;
              
              // Construct full image URL for front - use mobile image on small screens if available
              const isMobileScreen = window.innerWidth <= 768;
              const baseImageUrl = isMobileScreen && activeDesign.mobileImageUrl 
                ? activeDesign.mobileImageUrl 
                : activeDesign.imageUrl;
              
              const imageUrl = baseImageUrl 
                ? (baseImageUrl.startsWith('http://') || baseImageUrl.startsWith('https://')
                    ? baseImageUrl 
                    : `${getBaseApiUrl()}${baseImageUrl}`)
                : null;
              
              // Construct full image URL for back
              const backImageUrl = activeDesign.backCardImageUrl 
                ? (activeDesign.backCardImageUrl.startsWith('http://') || activeDesign.backCardImageUrl.startsWith('https://')
                    ? activeDesign.backCardImageUrl 
                    : `${getBaseApiUrl()}${activeDesign.backCardImageUrl}`)
                : null;
              
              // Front card style
              const activeCardStyle =
                (activeDesign.designType === 'image' || activeDesign.designType === 'reward') && imageUrl
                  ? {
                      backgroundImage: `url(${imageUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }
                  : activeDesign.designType === 'solid' && activeDesign.solidColor
                  ? {
                      background: activeDesign.solidColor,
                    }
                  : {
                      background: `linear-gradient(135deg, ${activeDesign.gradientColors?.primary || '#f66633'} 0%, ${activeDesign.gradientColors?.secondary || '#ff8c64'} 100%)`,
                    };

              // Back card style (use backCardImageUrl or backCardColor, fallback to gradient)
              const activeBackCardStyle = backImageUrl
                ? {
                    backgroundImage: `url(${backImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }
                : activeDesign.backCardColor
                ? {
                    background: activeDesign.backCardColor,
                  }
                : {
                    background: `linear-gradient(135deg, ${activeDesign.gradientColors?.primary || '#f66633'} 0%, ${activeDesign.gradientColors?.secondary || '#ff8c64'} 100%)`,
                  };

              const textColor = activeDesign.textColor || '#FFFFFF';

              return (
                <div
                  className="rounded-2xl shadow-xl border-3 cursor-pointer relative overflow-hidden mx-auto responsive-card-height"
                  style={{
                    borderColor: '#f66633',
                    borderWidth: '3px',
                    boxShadow: '0 4px 16px rgba(246, 102, 51, 0.3)',
                    color: textColor,
                    width: '100%',
                    maxWidth: '428px',
                  }}
                  onClick={() => setActiveCardFlipped(!activeCardFlipped)}
                >
                  <div className="card-flip-container absolute inset-0">
                    <div className={`card-flip-inner ${activeCardFlipped ? 'flipped' : ''} absolute inset-0`}>
                      {/* Front of Active Card */}
                      <div className="card-flip-front">
                        <div
                          className="rounded-2xl p-6 w-full h-full relative flex flex-col"
                          style={{
                            ...activeCardStyle,
                            color: textColor,
                          }}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="text-xs opacity-90 tracking-wider uppercase mb-1" style={{ color: textColor }}>ESPRO</div>
                              <div className="text-sm opacity-80" style={{ color: textColor }}>Collective Card</div>
                            </div>
                          </div>
                          
                          <div className="flex-1 min-h-0"></div>
                          
                          <div className="mt-auto pt-4 flex-shrink-0" style={{ borderTop: activeDesign.designType === 'image' || activeDesign.designType === 'reward' ? 'none' : `1px solid ${textColor}33` }}>
                            <div className="text-sm opacity-90 mb-2" style={{ color: textColor }}>Balance</div>
                            <div className="text-4xl font-bold tracking-tight" style={{ color: textColor }}>{formatEsproCoinsDisplay(user?.esproCoins || 0)}</div>
                            <div className="text-xs opacity-80 mt-1" style={{ color: textColor }}>espro coins</div>
                          </div>
                          <div className="absolute bottom-4 right-4 text-xs opacity-60" style={{ color: textColor }}>Tap to flip</div>
                        </div>
                      </div>

                      {/* Back of Active Card */}
                      <div className="card-flip-back">
                        <div
                          className="rounded-2xl p-6 w-full h-full flex flex-col justify-between"
                          style={{
                            ...activeBackCardStyle,
                            color: textColor,
                          }}
                        >
                          <div>
                            <div className="text-xs opacity-90 tracking-wider uppercase mb-2" style={{ color: textColor }}>ESPRO</div>
                            <div className="text-lg font-semibold mb-3" style={{ color: textColor }}>{activeDesign.name}</div>
                            <div className="text-sm opacity-90 leading-relaxed" style={{ color: textColor }}>
                              {activeDesign.description || 'No description available'}
                            </div>
                          </div>
                          <div className="mt-auto">
                            <div className="text-center mb-2">
                              <div className="text-xs opacity-90 mb-1" style={{ color: textColor }}>Loyalty ID</div>
                              <div className="text-sm font-mono tracking-wider opacity-100 font-semibold" style={{ color: textColor }}>{user?.loyaltyId || 'N/A'}</div>
                            </div>
                            <div className="text-xs opacity-60 text-center" style={{ color: textColor }}>Tap to flip back</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <div className="text-sm text-gray-600 mb-3 font-medium">Available Designs</div>
        {isLoadingCollectibles ? (
          <div className="text-center py-8 text-gray-500">Loading card designs...</div>
        ) : collectiblesError ? (
          <div className="text-center py-8 text-red-500">
            Error loading card designs: {collectiblesError.response?.data?.message || collectiblesError.message}
          </div>
        ) : collectibles && collectibles.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {collectibles.map((collectible) => {
            const isUnlocked = collectible.isUnlocked;
            const isActive = collectible._id === activeDesignId;
            
            // Construct full image URL - use mobile image on small screens if available
            const isMobileScreen = window.innerWidth <= 768;
            const baseImageUrl = isMobileScreen && collectible.mobileImageUrl 
              ? collectible.mobileImageUrl 
              : collectible.imageUrl;
            
            const imageUrl = baseImageUrl 
              ? (baseImageUrl.startsWith('http://') || baseImageUrl.startsWith('https://')
                  ? baseImageUrl 
                  : `${getBaseApiUrl()}${baseImageUrl}`)
              : null;
            
            const cardStyle =
              (collectible.designType === 'image' || collectible.designType === 'reward') && imageUrl
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

            const isActivating = activatingCardId === collectible._id;

            return (
              <div
                key={collectible._id}
                className={`relative rounded-xl overflow-hidden ${
                  isActive ? 'ring-2 ring-espro-orange' : ''
                } ${!isUnlocked ? 'opacity-50' : 'cursor-pointer'} ${isActivating ? 'opacity-75' : ''}`}
                onClick={() => {
                  if (isUnlocked && !isActive && !isActivating) {
                    activateMutation.mutate(collectible._id);
                  }
                }}
              >
                {/* Loading overlay */}
                {isActivating && (
                  <div className="absolute inset-0 bg-black/20 rounded-xl flex items-center justify-center z-10">
                    <div className="bg-white/90 rounded-lg p-3 flex flex-col items-center gap-2">
                      <svg className="animate-spin h-6 w-6 text-espro-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-xs font-medium text-gray-700">Activating...</span>
                    </div>
                  </div>
                )}
                
                <div className="h-32 p-3 relative" style={{ ...cardStyle, color: textColor }}>
                  <div className="text-xs opacity-90" style={{ color: textColor }}>ESPRO</div>
                  <div className="text-lg font-bold mt-1" style={{ color: textColor }}>{formatEsproCoinsDisplay(user?.esproCoins || 0)}</div>
                  {!isUnlocked && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded"></div>
                    </div>
                  )}
                </div>
                <div className="bg-white p-3">
                  <div className="text-sm font-semibold text-gray-800">{collectible.name}</div>
                  {isUnlocked ? (
                    <div className="text-xs text-gray-600 mt-1">
                      {isActive ? 'Active' : isActivating ? 'Activating...' : 'Tap to activate'}
                    </div>
                  ) : collectible.designType === 'reward' ? (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500">
                        Unlock by claiming a reward
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600">
                          {formatEsproCoinsDisplay(user?.lifetimeEsproCoins || 0)} / {formatEsproCoinsDisplay(collectible.lifetimeEsproCoinsRequired)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {Math.min(((user?.lifetimeEsproCoins || 0) / collectible.lifetimeEsproCoinsRequired) * 100, 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-espro-orange to-espro-teal rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(((user?.lifetimeEsproCoins || 0) / collectible.lifetimeEsproCoinsRequired) * 100, 100)}%` 
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatEsproCoinsDisplay(Math.max(0, collectible.lifetimeEsproCoinsRequired - (user?.lifetimeEsproCoins || 0)))} more needed
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No card designs available</div>
        )}
      </div>

      {/* Toast Notification */}
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </div>
  );
}

