import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerAPI, rewardsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatEsproCoinsDisplay } from '../utils/format';
import { getBaseApiUrl } from '../utils/api';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import RandomCardReveal from '../components/RandomCardReveal';

export default function Rewards() {
  const { user, fetchUser, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const [selectedReward, setSelectedReward] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });
  const [showRandomReveal, setShowRandomReveal] = useState(false);
  const [revealedCardDesign, setRevealedCardDesign] = useState(null);
  const [revealReward, setRevealReward] = useState(null);
  const [claimingRewardId, setClaimingRewardId] = useState(null); // Track which reward is being claimed
  const queryClient = useQueryClient();

  const { data: rewards, isLoading } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => customerAPI.getRewards().then((res) => res.data.rewards),
  });

  // Fetch collectibles for card design rewards
  const { data: collectiblesResponse } = useQuery({
    queryKey: ['collectibles'],
    queryFn: () => customerAPI.getCollectibles().then((res) => res.data.collectibles),
  });

  const collectibles = collectiblesResponse || [];

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh(
    [['rewards']],
    async () => {
      await fetchUser();
    }
  );

  const claimMutation = useMutation({
    mutationFn: (id) => rewardsAPI.claimReward(id),
    onSuccess: async (data) => {
      // Update user data in store with the remaining coins from response
      if (data?.data?.remainingCoins !== undefined) {
        updateUser({ esproCoins: data.data.remainingCoins });
      } else {
        // Fallback: fetch user data
        await fetchUser();
      }
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['rewards']);
      queryClient.invalidateQueries(['profile']);
      queryClient.invalidateQueries(['collectibles']);
      
      setSelectedReward(null);
      setShowConfirmModal(false);
      setClaimingRewardId(null); // Clear claiming state

      // Handle different reward types
      const claim = data?.data?.claim;
      const reward = claim?.reward || selectedReward;
      const rewardType = reward?.rewardType || 'voucher';
      
      // Only check for awardedCardDesign if it's a card design reward
      const isCardDesignReward = rewardType === 'specificCardDesign' || rewardType === 'randomCardDesign';
      const awardedCardDesign = data?.data?.awardedCardDesign;
      
      // For card design rewards, validate that we have awardedCardDesign
      if (isCardDesignReward) {
        // CRITICAL: Use data.data.awardedCardDesign as PRIMARY source (direct from API response)
        // This is the ACTUAL card that was just awarded by the backend
        // DO NOT use claim.awardedCardDesign as it might be from an old claim
        
        // Log all sources to debug ID mismatch
        console.log('[Rewards] API Response Analysis - CRITICAL:', {
          dataAwardedCardDesign: data?.data?.awardedCardDesign ? {
            _id: data.data.awardedCardDesign._id?.toString(),
            name: data.data.awardedCardDesign.name,
            imageUrl: data.data.awardedCardDesign.imageUrl
          } : null,
          claimAwardedCardDesign: claim?.awardedCardDesign ? {
            _id: claim.awardedCardDesign._id?.toString(),
            name: claim.awardedCardDesign.name
          } : null,
          finalAwardedCardDesign: awardedCardDesign ? {
            _id: awardedCardDesign._id?.toString(),
            name: awardedCardDesign.name
          } : null,
          usingDataAwardedCardDesign: !!data?.data?.awardedCardDesign,
          usingClaimAwardedCardDesign: !data?.data?.awardedCardDesign && !!claim?.awardedCardDesign
        });
        
        // CRITICAL: If we don't have awardedCardDesign from data.data, this is an error for card design rewards
        if (!awardedCardDesign) {
          console.error('[Rewards] CRITICAL: No awardedCardDesign in API response for card design reward!', {
            data: data?.data,
            claim: claim,
            rewardType
          });
          setToast({
            isOpen: true,
            message: 'Error: Could not determine awarded card design. Please refresh and try again.',
            type: 'error',
          });
          return;
        }
      } else {
        // For voucher rewards, just show success message
        setToast({
          isOpen: true,
          message: 'Reward claimed successfully!',
          type: 'success',
        });
        return;
      }

      console.log('[Rewards] Claim success - Full API Response:', {
        claim: claim ? {
          _id: claim._id?.toString(),
          awardedCardDesign: claim.awardedCardDesign ? {
            _id: claim.awardedCardDesign._id?.toString(),
            name: claim.awardedCardDesign.name
          } : null
        } : null,
        awardedCardDesignFromData: awardedCardDesign ? {
          _id: awardedCardDesign._id?.toString(),
          name: awardedCardDesign.name,
          imageUrl: awardedCardDesign.imageUrl
        } : null,
        reward: reward ? {
          _id: reward._id?.toString(),
          title: reward.title,
          rewardType: reward.rewardType,
          cardDesignIds: reward.cardDesignIds
        } : null
      });

      if (awardedCardDesign && reward) {
        // CRITICAL: Use the awardedCardDesign directly from the API response as the source of truth
        // The API response contains the actual card that was awarded - DO NOT use collectibles or reward pool
        let fullCardDesign = null;
        if (typeof awardedCardDesign === 'object' && awardedCardDesign._id) {
          // It's already a populated object from the API with all fields
          // This is the ACTUAL card that was awarded - use it directly, NO EXCEPTIONS
          fullCardDesign = awardedCardDesign;
          
          const awardedCardId = awardedCardDesign._id?.toString();
          console.log('[Rewards] Using awardedCardDesign directly from API - CRITICAL:', {
            _id: awardedCardId,
            name: awardedCardDesign.name,
            imageUrl: awardedCardDesign.imageUrl,
            designType: awardedCardDesign.designType
          });
          
          // Optionally merge with collectibles data ONLY for missing fields (not to replace the card)
          // But keep the API response as the primary source - DO NOT replace the awarded card
          const foundInCollectibles = collectibles.find(
            c => c._id.toString() === awardedCardId
          );
          if (foundInCollectibles) {
            // Merge but prioritize API response fields (awardedCardDesign comes last to override)
            // This ensures the API response is the source of truth
            fullCardDesign = { ...foundInCollectibles, ...awardedCardDesign };
            console.log('[Rewards] Merged with collectibles data, API response prioritized');
            
            // CRITICAL: Verify the ID matches after merge - if not, use API response directly
            const mergedId = fullCardDesign._id?.toString();
            if (mergedId !== awardedCardId) {
              console.error('[Rewards] CRITICAL: ID mismatch after merge! Using API response directly.', {
                mergedId,
                awardedCardId,
                fullCardDesignName: fullCardDesign.name,
                awardedCardDesignName: awardedCardDesign.name
              });
              // Use awardedCardDesign directly if merge caused ID change
              fullCardDesign = awardedCardDesign;
            } else {
              console.log('[Rewards] Merge successful, ID verified:', mergedId);
            }
          } else {
            console.log('[Rewards] Card not found in collectibles, using API response directly');
          }
        } else {
          // It's just an ID - find in collectibles
          const designId = awardedCardDesign._id || awardedCardDesign;
          fullCardDesign = collectibles.find(
            c => c._id.toString() === designId.toString()
          );
          console.log('[Rewards] Found card design in collectibles:', {
            designId: designId?.toString(),
            found: !!fullCardDesign,
            foundId: fullCardDesign?._id?.toString()
          });
        }
        
        // CRITICAL: Final verification - ensure fullCardDesign matches awardedCardDesign from API
        if (fullCardDesign && awardedCardDesign && awardedCardDesign._id) {
          const fullCardId = fullCardDesign._id?.toString();
          const awardedCardId = awardedCardDesign._id?.toString();
          if (fullCardId !== awardedCardId) {
            console.error('[Rewards] CRITICAL MISMATCH: fullCardDesign does not match awardedCardDesign!', {
              fullCardId,
              fullCardName: fullCardDesign.name,
              awardedCardId,
              awardedCardName: awardedCardDesign.name
            });
            // Use awardedCardDesign directly as it's the source of truth
            fullCardDesign = awardedCardDesign;
            console.log('[Rewards] Corrected: Using awardedCardDesign directly from API');
          }
        }

        console.log('[Rewards] Full card design found - FINAL:', {
          fullCardDesign: fullCardDesign ? {
            _id: fullCardDesign._id?.toString(),
            name: fullCardDesign.name,
            imageUrl: fullCardDesign.imageUrl,
            designType: fullCardDesign.designType
          } : null,
          awardedCardDesignFromAPI: awardedCardDesign ? {
            _id: awardedCardDesign._id?.toString(),
            name: awardedCardDesign.name,
            imageUrl: awardedCardDesign.imageUrl
          } : null,
          claimAwardedCardDesign: claim?.awardedCardDesign ? {
            _id: claim.awardedCardDesign._id?.toString(),
            name: claim.awardedCardDesign.name
          } : null,
          dataAwardedCardDesign: data?.data?.awardedCardDesign ? {
            _id: data.data.awardedCardDesign._id?.toString(),
            name: data.data.awardedCardDesign.name
          } : null
        });

        // Show randomizer animation for random card design rewards
        if (reward.rewardType === 'randomCardDesign') {
          console.log('[Rewards] Setting up random reveal:', {
            fullCardDesign,
            reward,
            cardDesignIds: reward.cardDesignIds,
            collectiblesLength: collectibles.length,
            collectibles: collectibles.map(c => ({ id: c._id, name: c.name }))
          });
          
          if (fullCardDesign && reward.cardDesignIds && reward.cardDesignIds.length > 0) {
            // CRITICAL: Final verification before setting revealed card
            const finalCardId = fullCardDesign._id?.toString();
            const apiCardId = awardedCardDesign._id?.toString();
            
            console.log('[Rewards] All data present, opening random reveal modal - CRITICAL CHECK:', {
              fullCardDesign: {
                _id: finalCardId,
                name: fullCardDesign.name
              },
              awardedCardDesignFromAPI: {
                _id: apiCardId,
                name: awardedCardDesign.name
              },
              idsMatch: finalCardId === apiCardId,
              willUse: finalCardId === apiCardId ? 'fullCardDesign' : 'awardedCardDesign (corrected)'
            });
            
            // CRITICAL: If IDs don't match, use awardedCardDesign directly from API
            if (finalCardId !== apiCardId) {
              console.error('[Rewards] CRITICAL: ID mismatch before setting revealed card! Using API response.', {
                fullCardId: finalCardId,
                apiCardId: apiCardId
              });
              setRevealedCardDesign(awardedCardDesign); // Use API response directly
            } else {
              setRevealedCardDesign(fullCardDesign);
            }
            setRevealReward(reward);
            setShowRandomReveal(true);
          } else {
            // Fallback if data is missing
            console.error('[Rewards] Missing data for random reveal:', { 
              fullCardDesign, 
              reward,
              hasCardDesignIds: !!reward.cardDesignIds,
              cardDesignIdsLength: reward.cardDesignIds?.length
            });
            setToast({
              isOpen: true,
              message: `Reward claimed! You unlocked: ${fullCardDesign?.name || 'Card Design'}`,
              type: 'success',
            });
          }
        } else if (reward.rewardType === 'specificCardDesign') {
          // For specific card design, just show success message with card name
          setToast({
            isOpen: true,
            message: `Reward claimed! You unlocked: ${fullCardDesign.name || awardedCardDesign.name || 'Card Design'}`,
            type: 'success',
          });
        } else {
          setToast({
            isOpen: true,
            message: 'Reward claimed successfully!',
            type: 'success',
          });
        }
      } else {
        setToast({
          isOpen: true,
          message: 'Reward claimed successfully!',
          type: 'success',
        });
      }
      
      // Clear claiming state and close modal after success
      setClaimingRewardId(null);
      setShowConfirmModal(false);
      setSelectedReward(null);
    },
    onError: (error) => {
      setShowConfirmModal(false);
      setClaimingRewardId(null); // Clear claiming state on error
      setToast({
        isOpen: true,
        message: error.response?.data?.message || 'Failed to claim reward',
        type: 'error',
      });
    },
  });

  const handleClaimClick = (reward) => {
    // Prevent double clicks - if already claiming this reward, ignore
    if (claimingRewardId === reward._id || claimMutation.isLoading) {
      return;
    }

    if (user.esproCoins < reward.esproCoinsRequired) {
      setToast({
        isOpen: true,
        message: 'Insufficient espro coins',
        type: 'error',
      });
      return;
    }
    setSelectedReward(reward);
    setShowConfirmModal(true);
  };

  const handleConfirmClaim = () => {
    if (selectedReward && !claimingRewardId) {
      // Set claiming state immediately to prevent double clicks
      setClaimingRewardId(selectedReward._id);
      claimMutation.mutate(selectedReward._id);
    }
  };

  return (
    <div className="min-h-screen bg-fafafa relative">
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
            <div className="font-bold text-xl text-gray-900">Rewards</div>
            <div className="text-sm text-gray-600">{formatEsproCoinsDisplay(user?.esproCoins || 0)} espro coins available</div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading rewards...</div>
        ) : rewards && rewards.length > 0 ? (
          <div className="space-y-4">
            {rewards.map((reward) => {
              const canClaim = user.esproCoins >= reward.esproCoinsRequired;
              const isStoreClaimable = reward.claimableAtStore === true;
              const isCardDesignReward = reward.rewardType === 'specificCardDesign' || reward.rewardType === 'randomCardDesign';
              const availableVoucherCount = reward.availableVoucherCount ?? (reward.quantity === -1 ? -1 : reward.quantity);
              const hasAvailableVouchers = availableVoucherCount === -1 || availableVoucherCount > 0;
              const canClaimReward = canClaim && (hasAvailableVouchers || isCardDesignReward) && !isStoreClaimable;
              const borderColor = canClaimReward ? (reward.esproCoinsRequired <= 500 ? '#f66633' : '#3a878c') : '#e5e5e5';
              
              // Construct full image URL
              const imageUrl = reward.imageUrl 
                ? (reward.imageUrl.startsWith('http://') || reward.imageUrl.startsWith('https://')
                    ? reward.imageUrl 
                    : `${getBaseApiUrl()}${reward.imageUrl}`)
                : null;
              
              return (
                <div
                  key={reward._id}
                  className={`bg-white rounded-xl p-5 shadow-sm border-l-4 ${
                    !canClaim && !isStoreClaimable ? 'opacity-50' : ''
                  }`}
                  style={{ borderLeftColor: borderColor }}
                >
                  <div className="flex gap-4">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={reward.title}
                        className="w-20 h-20 rounded-xl flex-shrink-0 object-cover"
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-xl flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${borderColor}, ${borderColor}dd)`,
                        }}
                      />
                    )}
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-semibold text-lg text-gray-900">{reward.title}</div>
                              </div>
                              <div className="text-sm text-gray-600">{reward.description}</div>
                              {isCardDesignReward && reward.cardDesignIds && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {reward.rewardType === 'randomCardDesign' 
                                    ? `${reward.cardDesignIds.length} card designs in pool`
                                    : '1 specific card design'}
                                </div>
                              )}
                              {!isCardDesignReward && reward.hasVoucherCodes && availableVoucherCount >= 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {availableVoucherCount === 0 ? (
                                    <span className="text-red-600 font-medium">Out of stock</span>
                                  ) : (
                                    <span>{availableVoucherCount} voucher{availableVoucherCount !== 1 ? 's' : ''} available</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              {isStoreClaimable ? (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Store Only</span>
                              ) : canClaimReward ? (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Available</span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">Locked</span>
                              )}
                              {isCardDesignReward && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium whitespace-nowrap">
                                  {reward.rewardType === 'specificCardDesign' ? 'Card Design' : 'Random Card'}
                                </span>
                              )}
                            </div>
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full"
                            style={{ backgroundColor: borderColor }}
                          />
                          <span className="font-bold" style={{ color: borderColor }}>
                            {formatEsproCoinsDisplay(reward.esproCoinsRequired)} coins
                          </span>
                        </div>
                        {isStoreClaimable ? (
                          <div className="text-xs text-blue-600 font-medium">
                            Claim at store
                          </div>
                        ) : canClaimReward ? (
                          <button
                            onClick={() => handleClaimClick(reward)}
                            disabled={claimMutation.isLoading || claimingRewardId === reward._id}
                            className="px-5 py-2 rounded-full font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            style={{
                              backgroundColor: borderColor,
                            }}
                          >
                            {(claimMutation.isLoading && selectedReward?._id === reward._id) || claimingRewardId === reward._id ? (
                              <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Claiming...
                              </>
                            ) : (
                              'Claim'
                            )}
                          </button>
                        ) : !hasAvailableVouchers ? (
                          <div className="text-xs text-red-600 font-medium">
                            Out of stock
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">
                            Need {formatEsproCoinsDisplay(reward.esproCoinsRequired - (user?.esproCoins || 0))} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No rewards available</div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          if (!claimMutation.isLoading && !claimingRewardId) {
          setShowConfirmModal(false);
          setSelectedReward(null);
          }
        }}
        onConfirm={handleConfirmClaim}
        title="Claim Reward"
        message={
          selectedReward
            ? `Are you sure you want to claim "${selectedReward.title}" for ${formatEsproCoinsDisplay(selectedReward.esproCoinsRequired)} espro coins?`
            : ''
        }
        confirmText="Claim"
        cancelText="Cancel"
        isLoading={claimMutation.isLoading || claimingRewardId === selectedReward?._id}
      />

      {/* Toast Notification */}
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />

      {/* Random Card Reveal Modal */}
      {showRandomReveal && (() => {
        // Map cardDesignIds to full collectible objects
        // cardDesignIds from the API might be populated objects or just IDs
        let mappedCardDesigns = revealReward && revealReward.cardDesignIds && revealReward.cardDesignIds.length > 0
          ? revealReward.cardDesignIds
              .map(idOrObj => {
                // Handle both populated objects and just IDs
                let designId;
                let populatedObj = null;
                
                if (typeof idOrObj === 'object' && idOrObj._id) {
                  // It's a populated object from the API
                  designId = idOrObj._id;
                  populatedObj = idOrObj;
                } else {
                  // It's just an ID
                  designId = idOrObj._id || idOrObj;
                }
                
                // Try to find in collectibles array first (most up-to-date)
                const found = collectibles.find(c => 
                  c._id.toString() === designId.toString()
                );
                
                // If found, use it (has all fields including imageUrl)
                if (found) {
                  return found;
                }
                
                // If not found but we have a populated object, use it
                if (populatedObj) {
                  return populatedObj;
                }
                
                // Otherwise, return null (will be filtered out)
                return null;
              })
              .filter(Boolean)
          : [];
        
        // CRITICAL: Ensure revealedCardDesign is always in the array and is the source of truth
        // The revealedCardDesign is the ACTUAL card awarded by the API - it must be used, not a card from the pool
        if (revealedCardDesign && revealedCardDesign._id) {
          const revealedId = revealedCardDesign._id.toString();
          const existingIndex = mappedCardDesigns.findIndex(c => 
            c && c._id && c._id.toString() === revealedId
          );
          
          console.log('[Rewards] Ensuring revealed card in mapped designs:', {
            revealedId,
            revealedCardName: revealedCardDesign.name,
            existingIndex,
            mappedCardDesignsBefore: mappedCardDesigns.map(c => ({ id: c._id?.toString(), name: c.name }))
          });
          
          if (existingIndex !== -1) {
            // Replace with the full revealedCardDesign (has all fields including imageUrl from API)
            // This ensures we use the API response as the source of truth, not a card from the pool
            mappedCardDesigns[existingIndex] = revealedCardDesign;
            console.log('[Rewards] Replaced existing card at index:', existingIndex, 'with actual awarded card:', revealedCardDesign.name);
          } else {
            // Add the revealedCardDesign to the array (it's the awarded card from API)
            // This is the ACTUAL card that was awarded, not a card from the pool
            mappedCardDesigns.push(revealedCardDesign);
            console.log('[Rewards] Added revealed card to array at index:', mappedCardDesigns.length - 1, 'Actual awarded card:', revealedCardDesign.name);
          }
          
          // CRITICAL: Verify the revealed card is in the array with the correct ID
          const verifiedIndex = mappedCardDesigns.findIndex(c => 
            c && c._id && c._id.toString() === revealedId
          );
          if (verifiedIndex === -1) {
            console.error('[Rewards] CRITICAL: Revealed card not found in mapped designs after ensuring!', {
              revealedId,
              mappedCardDesignsIds: mappedCardDesigns.map(c => c._id?.toString())
            });
          } else {
            console.log('[Rewards] Verified revealed card is at index:', verifiedIndex);
          }
        } else if (revealedCardDesign && !mappedCardDesigns.length) {
          // If no mapped designs but we have revealedCardDesign, use it
          mappedCardDesigns = [revealedCardDesign];
          console.log('[Rewards] Using revealed card as only card in array');
        }
        
        console.log('[Rewards] Rendering RandomCardReveal:', {
          showRandomReveal,
          revealReward: revealReward ? { 
            _id: revealReward._id, 
            cardDesignIds: revealReward.cardDesignIds,
            cardDesignIdsLength: revealReward.cardDesignIds?.length 
          } : null,
          revealedCardDesign: revealedCardDesign ? { 
            _id: revealedCardDesign._id, 
            name: revealedCardDesign.name,
            imageUrl: revealedCardDesign.imageUrl,
            designType: revealedCardDesign.designType
          } : null,
          mappedCardDesignsLength: mappedCardDesigns.length,
          mappedCardDesigns: mappedCardDesigns.map(c => ({ 
            id: c._id, 
            name: c.name,
            imageUrl: c.imageUrl,
            designType: c.designType,
            gradientColors: c.gradientColors,
            solidColor: c.solidColor,
            textColor: c.textColor
          })),
          collectiblesLength: collectibles.length,
          collectiblesSample: collectibles.slice(0, 2).map(c => ({
            id: c._id,
            name: c.name,
            imageUrl: c.imageUrl,
            designType: c.designType
          }))
        });
        
        return (
          <RandomCardReveal
            isOpen={showRandomReveal}
            onClose={() => {
              console.log('[Rewards] Closing random reveal modal');
              setShowRandomReveal(false);
              setRevealedCardDesign(null);
              setRevealReward(null);
            }}
            cardDesigns={mappedCardDesigns}
            revealedCardDesign={revealedCardDesign}
            reward={revealReward}
            onRevealComplete={async () => {
              console.log('[Rewards] Random reveal complete, refreshing data');
              // User data is already updated from claimMutation.onSuccess
              // Collectibles are already invalidated in claimMutation.onSuccess
              await fetchUser();
            }}
          />
        );
      })()}
    </div>
  );
}

