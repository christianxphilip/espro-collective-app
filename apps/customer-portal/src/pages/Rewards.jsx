import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerAPI, rewardsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatEsproCoinsDisplay } from '../utils/format';
import { getBaseApiUrl } from '../utils/api';
import ConfirmModal from '../components/ConfirmModal';
import Toast from '../components/Toast';

export default function Rewards() {
  const { user, fetchUser, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const [selectedReward, setSelectedReward] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });
  const queryClient = useQueryClient();

  const { data: rewards, isLoading } = useQuery({
    queryKey: ['rewards'],
    queryFn: () => customerAPI.getRewards().then((res) => res.data.rewards),
  });

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
      setSelectedReward(null);
      setShowConfirmModal(false);
      setToast({
        isOpen: true,
        message: 'Reward claimed successfully!',
        type: 'success',
      });
    },
    onError: (error) => {
      setShowConfirmModal(false);
      setToast({
        isOpen: true,
        message: error.response?.data?.message || 'Failed to claim reward',
        type: 'error',
      });
    },
  });

  const handleClaimClick = (reward) => {
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
    if (selectedReward) {
      claimMutation.mutate(selectedReward._id);
    }
  };

  return (
    <div className="min-h-screen bg-fafafa">
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
              const availableVoucherCount = reward.availableVoucherCount ?? (reward.quantity === -1 ? -1 : reward.quantity);
              const hasAvailableVouchers = availableVoucherCount === -1 || availableVoucherCount > 0;
              const canClaimReward = canClaim && hasAvailableVouchers && !isStoreClaimable;
              const borderColor = canClaimReward ? (reward.esproCoinsRequired <= 500 ? '#f66633' : '#3a878c') : '#e5e5e5';
              
              // Construct full image URL
              const imageUrl = reward.imageUrl 
                ? (reward.imageUrl.startsWith('http') 
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
                          <div className="font-semibold text-lg text-gray-900 mb-1">{reward.title}</div>
                          <div className="text-sm text-gray-600">{reward.description}</div>
                          {reward.hasVoucherCodes && availableVoucherCount >= 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              {availableVoucherCount === 0 ? (
                                <span className="text-red-600 font-medium">Out of stock</span>
                              ) : (
                                <span>{availableVoucherCount} voucher{availableVoucherCount !== 1 ? 's' : ''} available</span>
                              )}
                            </div>
                          )}
                        </div>
                        {isStoreClaimable ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium flex-shrink-0">Store Only</span>
                        ) : canClaimReward ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium flex-shrink-0">Available</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium flex-shrink-0">Locked</span>
                        )}
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
                            disabled={claimMutation.isLoading}
                            className="px-5 py-2 rounded-full font-medium text-white transition-colors"
                            style={{
                              backgroundColor: borderColor,
                            }}
                          >
                            Claim
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
          setShowConfirmModal(false);
          setSelectedReward(null);
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
        isLoading={claimMutation.isLoading}
      />

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

