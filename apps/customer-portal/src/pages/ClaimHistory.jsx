import { useQuery } from '@tanstack/react-query';
import { customerAPI } from '../services/api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBaseApiUrl } from '../utils/api';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import useAuthStore from '../store/authStore';
import Barcode from '../components/Barcode';

export default function ClaimHistory() {
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();
  const [selectedClaim, setSelectedClaim] = useState(null);
  const { data: claims, isLoading } = useQuery({
    queryKey: ['claims'],
    queryFn: () => customerAPI.getClaims().then((res) => res.data.claims),
    staleTime: 2 * 60 * 1000, // 2 minutes (claims can change frequently)
  });

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh(
    [['claims']],
    async () => {
      await fetchUser();
    }
  );

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
      
      <div className="bg-white shadow-sm sticky top-0 z-10 px-4 pt-4 pb-2 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-lg font-bold text-gray-800">Claim History</div>
      </div>

      <div className="px-4 pb-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading history...</div>
        ) : claims && claims.length > 0 ? (
          <div className="space-y-4">
            {claims.map((claim) => (
              <div
                key={claim._id}
                className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-espro-orange cursor-pointer"
                onClick={() => setSelectedClaim(claim)}
              >
                <div className="flex gap-4">
                  {(() => {
                    const imageUrl = claim.reward?.imageUrl 
                      ? (claim.reward.imageUrl.startsWith('http://') || claim.reward.imageUrl.startsWith('https://')
                          ? claim.reward.imageUrl 
                          : `${getBaseApiUrl()}${claim.reward.imageUrl}`)
                      : null;
                    return imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={claim.reward.title}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                    ) : null;
                  })()}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 mb-1">{claim.reward?.title}</div>
                    <div className="text-sm text-gray-600 mb-2">
                      Claimed on {new Date(claim.claimedAt).toLocaleDateString()}
                    </div>
                    {claim.voucherCode && (
                      <>
                        <div className="text-xs text-gray-500 font-mono mb-2">{claim.voucherCode}</div>
                        <div className="mt-2">
                          <Barcode value={claim.voucherCode} options={{ height: 40, fontSize: 10, margin: 5 }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No claims yet</div>
        )}
      </div>

      {selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedClaim(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-bold mb-4">{selectedClaim.reward?.title}</div>
            {(() => {
              const voucherImageUrl = selectedClaim.reward?.voucherImageUrl 
                ? (selectedClaim.reward.voucherImageUrl.startsWith('http://') || selectedClaim.reward.voucherImageUrl.startsWith('https://')
                    ? selectedClaim.reward.voucherImageUrl 
                    : `${getBaseApiUrl()}${selectedClaim.reward.voucherImageUrl}`)
                : null;
              return voucherImageUrl ? (
                <img
                  src={voucherImageUrl}
                  alt="Voucher"
                  className="w-full rounded-lg mb-4"
                />
              ) : null;
            })()}
            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-600 mb-2">Voucher Code</div>
              <div className="text-lg font-mono font-semibold mb-3">{selectedClaim.voucherCode}</div>
              <Barcode value={selectedClaim.voucherCode} options={{ height: 60, fontSize: 14 }} />
            </div>
            <button
              onClick={() => setSelectedClaim(null)}
              className="w-full bg-espro-orange text-white py-2 rounded-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

