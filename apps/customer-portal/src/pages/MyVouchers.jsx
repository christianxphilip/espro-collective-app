import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../services/api';
import { FaArrowLeft, FaCheckCircle, FaClock } from 'react-icons/fa';
import { getBaseApiUrl } from '../utils/api';

export default function MyVouchers() {
  const navigate = useNavigate();
  const { data: vouchersData, isLoading } = useQuery({
    queryKey: ['vouchers'],
    queryFn: () => customerAPI.getVouchers().then((res) => res.data.vouchers),
  });

  const available = vouchersData?.available || [];
  const used = vouchersData?.used || [];

  return (
    <div className="min-h-screen bg-fafafa">
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

