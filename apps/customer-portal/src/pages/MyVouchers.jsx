import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../services/api';
import { FaArrowLeft, FaCheckCircle, FaClock } from 'react-icons/fa';
import { getBaseApiUrl } from '../utils/api';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import useAuthStore from '../store/authStore';
import Barcode from '../components/Barcode';

export default function MyVouchers() {
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('available'); // 'available' or 'used'
  
  const { data: vouchersData, isLoading } = useQuery({
    queryKey: ['vouchers'],
    queryFn: () => customerAPI.getVouchers().then((res) => res.data.vouchers),
    staleTime: 2 * 60 * 1000, // 2 minutes (vouchers can change frequently)
  });

  // Pull to refresh
  const { isRefreshing } = usePullToRefresh(
    [['vouchers']],
    async () => {
      await fetchUser();
    }
  );

  const available = vouchersData?.available || [];
  const used = vouchersData?.used || [];

  return (
    <div className="min-h-screen bg-fafafa relative">
      
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
            {/* Tabs */}
            <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('available')}
                className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                  activeTab === 'available'
                    ? 'bg-white text-espro-orange shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FaClock className={activeTab === 'available' ? 'text-espro-orange' : 'text-gray-400'} />
                  <span>Available ({available.length})</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('used')}
                className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                  activeTab === 'used'
                    ? 'bg-white text-gray-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FaCheckCircle className={activeTab === 'used' ? 'text-gray-600' : 'text-gray-400'} />
                  <span>Used ({used.length})</span>
                </div>
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'available' ? (
              <div>
                {available.length > 0 ? (
                  <div className="space-y-3">
                    {available.map((voucher) => {
                      const imageUrl = voucher.reward?.imageUrl 
                        ? (voucher.reward.imageUrl.startsWith('http://') || voucher.reward.imageUrl.startsWith('https://')
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
                                <div className="text-xs text-gray-600 mb-2">Voucher Code</div>
                                <div className="text-lg font-mono font-semibold text-gray-900 mb-2">{voucher.voucherCode}</div>
                                <Barcode value={voucher.voucherCode} options={{ height: 50, fontSize: 12 }} />
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
            ) : (
              <div>
                {used.length > 0 ? (
                  <div className="space-y-3">
                    {used.map((voucher) => {
                      const imageUrl = voucher.reward?.imageUrl 
                        ? (voucher.reward.imageUrl.startsWith('http://') || voucher.reward.imageUrl.startsWith('https://')
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
                              <div className="bg-gray-100 rounded-lg p-3 mb-2 opacity-60">
                                <div className="text-xs text-gray-600 mb-2">Voucher Code</div>
                                <div className="text-lg font-mono font-semibold text-gray-900 line-through mb-2">{voucher.voucherCode}</div>
                                <Barcode value={voucher.voucherCode} options={{ height: 50, fontSize: 12 }} />
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
            )}
          </>
        )}
      </div>
    </div>
  );
}

