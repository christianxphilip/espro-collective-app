import { useQuery } from '@tanstack/react-query';
import { customerAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { getBaseApiUrl } from '../utils/api';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import useAuthStore from '../store/authStore';

export default function Promotions() {
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();
  const { data: promotions, isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: () => customerAPI.getPromotions().then((res) => res.data.promotions),
  });

  // Pull to refresh
  const { isRefreshing, pullDistance } = usePullToRefresh(
    [['promotions']],
    async () => {
      await fetchUser();
    }
  );

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
          <div className="font-bold text-xl text-gray-900">Promotions</div>
        </div>
      </div>

      <div className="px-4 pb-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading promotions...</div>
        ) : promotions && promotions.length > 0 ? (
          <div className="space-y-4">
            {promotions.map((promo) => {
              // Construct full image URL
              const imageUrl = promo.imageUrl 
                ? (promo.imageUrl.startsWith('http://') || promo.imageUrl.startsWith('https://')
                    ? promo.imageUrl 
                    : `${getBaseApiUrl()}${promo.imageUrl}`)
                : null;
              
              return (
              <div
                key={promo._id}
                className="bg-gradient-to-r from-espro-teal to-espro-orange rounded-xl p-6 text-white cursor-pointer shadow-lg hover:shadow-xl transition-shadow min-h-[180px] flex items-center justify-center"
                onClick={() => {
                  if (promo.linkUrl) {
                    window.open(promo.linkUrl, '_blank');
                  }
                }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={promo.title}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="text-center">
                    <div className="font-bold text-xl mb-2">{promo.title}</div>
                    {promo.description && (
                      <div className="text-sm opacity-90">{promo.description}</div>
                    )}
                  </div>
                )}
              </div>
            );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No promotions available</div>
        )}
      </div>
    </div>
  );
}

