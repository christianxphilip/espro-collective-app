import { useQuery } from '@tanstack/react-query';
import { customerAPI } from '../services/api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBaseApiUrl } from '../utils/api';

export default function ClaimHistory() {
  const navigate = useNavigate();
  const [selectedClaim, setSelectedClaim] = useState(null);
  const { data: claims, isLoading } = useQuery({
    queryKey: ['claims'],
    queryFn: () => customerAPI.getClaims().then((res) => res.data.claims),
  });

  return (
    <div className="min-h-screen bg-fafafa">
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
                      ? (claim.reward.imageUrl.startsWith('http') 
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
                    <div className="text-xs text-gray-500 font-mono">{claim.voucherCode}</div>
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
                ? (selectedClaim.reward.voucherImageUrl.startsWith('http') 
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
              <div className="text-sm text-gray-600 mb-1">Voucher Code</div>
              <div className="text-lg font-mono font-semibold">{selectedClaim.voucherCode}</div>
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

