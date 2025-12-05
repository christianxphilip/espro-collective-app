import { useQuery } from '@tanstack/react-query';
import { customerAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { getBaseApiUrl } from '../utils/api';

export default function Promotions() {
  const navigate = useNavigate();
  const { data: promotions, isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: () => customerAPI.getPromotions().then((res) => res.data.promotions),
  });

  return (
    <div className="min-h-screen bg-gray-50">
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
                ? (promo.imageUrl.startsWith('http') 
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

