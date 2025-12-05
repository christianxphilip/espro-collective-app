import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../services/api';
import { FaArrowLeft, FaCheckCircle, FaClock } from 'react-icons/fa';
import { getBaseApiUrl } from '../utils/api';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import useAuthStore from '../store/authStore';

export default function MyVouchers() {
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();
  const { data: vouchersData, isLoading } = useQuery({
    queryKey: ['vouchers'],
    queryFn: () => customerAPI.getVouchers().then((res) => res.data.vouchers),
  });

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh(
    [['vouchers']],
    async () => {
      await fetchUser();
    }
  );

  const available = vouchersData?.available || [];
  const used = vouchersData?.used || [];

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
      <div className="bg-transparent px-4 pt-4 pb-2 flex items-center">
        <button onClick={() => navigate(-1)} className="mr-4 text-gray-600 hover:text-gray-900">
          <FaArrowLeft className="text-xl" />
        </button>
        <div>
          <div className="font-bold text-xl text-gray-900">My Vouchers</div>
          <div className="text-sm text-gray-600">{vouchersData?.total || 0} total vouchers</div>
        </div>
      </div>

      <div className="px-4 pb-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading vouchers...</div>
        ) : (
          <>
            {/* Available Vouchers */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <FaClock className="text-espro-orange" />
                <div className="font-semibold text-gray-900">Available ({available.length})</div>
              </div>
              {available.length > 0 ? (
                <div className="space-y-3">
                  {available.map((voucher) => {
                    const imageUrl = voucher.reward?.imageUrl 
                      ? (voucher.reward.imageUrl.startsWith('http') 
                          ? voucher.reward.imageUrl 
                          : `${getBaseApiUrl()}${voucher.reward.imageUrl}`)
                      : null;
                    
                    return (
                      <div
                        key={voucher._id}
                        className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-espro-orange"
                      >
                        <div className="flex gap-4">
                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt={voucher.reward?.title}
                              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-1">{voucher.reward?.title}</div>
                            {voucher.reward?.description && (
                              <div className="text-sm text-gray-600 mb-2">{voucher.reward.description}</div>
                            )}
                            <div className="bg-gray-100 rounded-lg p-3 mb-2">
                              <div className="text-xs text-gray-600 mb-1">Voucher Code</div>
                              <div className="text-lg font-mono font-semibold text-gray-900">{voucher.voucherCode}</div>
                            </div>
                            <div className="text-xs text-gray-500">
                              Claimed on {new Date(voucher.claimedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl p-6 text-center text-gray-500">
                  No available vouchers
                </div>
              )}
            </div>

            {/* Used Vouchers */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FaCheckCircle className="text-gray-400" />
                <div className="font-semibold text-gray-900">Used ({used.length})</div>
              </div>
              {used.length > 0 ? (
                <div className="space-y-3">
                  {used.map((voucher) => {
                    const imageUrl = voucher.reward?.imageUrl 
                      ? (voucher.reward.imageUrl.startsWith('http') 
                          ? voucher.reward.imageUrl 
                          : `${getBaseApiUrl()}${voucher.reward.imageUrl}`)
                      : null;
                    
                    return (
                      <div
                        key={voucher._id}
                        className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-gray-300 opacity-60"
                      >
                        <div className="flex gap-4">
                          {imageUrl && (
                            <img
                              src={imageUrl}
                              alt={voucher.reward?.title}
                              className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-1">{voucher.reward?.title}</div>
                            {voucher.reward?.description && (
                              <div className="text-sm text-gray-600 mb-2">{voucher.reward.description}</div>
                            )}
                            <div className="bg-gray-100 rounded-lg p-3 mb-2">
                              <div className="text-xs text-gray-600 mb-1">Voucher Code</div>
                              <div className="text-lg font-mono font-semibold text-gray-900 line-through">{voucher.voucherCode}</div>
                            </div>
                            <div className="text-xs text-gray-500">
                              Used on {voucher.usedAt ? new Date(voucher.usedAt).toLocaleDateString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl p-6 text-center text-gray-500">
                  No used vouchers
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

