import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from '../store/authStore';
import { customerAPI } from '../services/api';
import WalletCard from '../components/WalletCard';
import { formatEsproCoinsDisplay } from '../utils/format';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

export default function Home() {
  const { user, fetchUser } = useAuthStore();
  const navigate = useNavigate();

  // Scroll to top when component mounts (e.g., after login)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Also check mobile-container if it exists
    const container = document.querySelector('.mobile-container');
    if (container) {
      container.scrollTop = 0;
    }
  }, []);

  const { data: promotions } = useQuery({
    queryKey: ['promotions'],
    queryFn: () => customerAPI.getPromotions().then((res) => res.data.promotions),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: collectibles } = useQuery({
    queryKey: ['collectibles'],
    queryFn: () => customerAPI.getCollectibles().then((res) => res.data.collectibles),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });


  // Pull to refresh
  const { isRefreshing } = usePullToRefresh(
    [['promotions'], ['collectibles']],
    async () => {
      // Also refresh user data from auth store
      await fetchUser();
    }
  );

  // Find next collectible to unlock
  const nextCollectible = collectibles?.find(
    (c) => !c.isUnlocked && c.lifetimeEsproCoinsRequired > (user?.lifetimeEsproCoins || 0)
  );

  const progressToNext =
    nextCollectible
      ? ((user?.lifetimeEsproCoins || 0) / nextCollectible.lifetimeEsproCoinsRequired) * 100
      : 100;

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="bg-transparent px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-bold text-gray-900">
              Welcome Back, {user?.name?.split(' ')[0] || 'User'}
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 bg-gradient-to-br from-espro-orange to-espro-teal rounded-full flex items-center justify-center text-white font-bold text-lg hover:opacity-90 transition-opacity cursor-pointer"
          >
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </button>
        </div>
      </div>

      <div className="px-4 pb-4">
        {/* Wallet Card */}
        <WalletCard />

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div
            className="bg-white rounded-xl p-4 text-center cursor-pointer shadow-sm hover:shadow-md transition-shadow"
            onClick={() => navigate('/qr')}
          >
            <div className="w-10 h-10 bg-espro-cream rounded-full mx-auto mb-2 flex items-center justify-center">
              {/* QR Code Icon */}
              <svg className="w-5 h-5 text-espro-orange" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm0 4h3v2h-3v-2zm-4-4h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
              </svg>
            </div>
            <div className="text-xs text-gray-600">Show QR</div>
          </div>
          <div
            className="bg-white rounded-xl p-4 text-center cursor-pointer shadow-sm hover:shadow-md transition-shadow"
            onClick={() => navigate('/rewards')}
          >
            <div className="w-10 h-10 bg-espro-cream rounded-full mx-auto mb-2 flex items-center justify-center">
              {/* Gift Icon */}
              <svg className="w-5 h-5 text-espro-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div className="text-xs text-gray-600">Rewards</div>
          </div>
          <div
            className="bg-white rounded-xl p-4 text-center cursor-pointer shadow-sm hover:shadow-md transition-shadow"
            onClick={() => navigate('/vouchers')}
          >
            <div className="w-10 h-10 bg-espro-cream rounded-full mx-auto mb-2 flex items-center justify-center">
              {/* Voucher/Ticket Icon */}
              <svg className="w-5 h-5 text-espro-brown" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <div className="text-xs text-gray-600">Vouchers</div>
          </div>
        </div>

        {/* Progress Card */}
        {nextCollectible && (
          <div 
            className="bg-white rounded-xl p-4 mb-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/collections')}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="font-semibold text-gray-900">Progress to Next Card Design</div>
              <div className="text-xs text-gray-600">{Math.min(progressToNext, 100).toFixed(0)}%</div>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-espro-orange to-espro-teal rounded-full transition-all"
                style={{ width: `${Math.min(progressToNext, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-600">
              <span>
                {formatEsproCoinsDisplay(user?.lifetimeEsproCoins || 0)} / {formatEsproCoinsDisplay(nextCollectible.lifetimeEsproCoinsRequired)} coins
              </span>
              <span className="text-espro-orange font-medium">
                {formatEsproCoinsDisplay(nextCollectible.lifetimeEsproCoinsRequired - (user?.lifetimeEsproCoins || 0))} more needed
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-xs text-espro-orange font-medium text-center">Tap to view all card designs →</div>
            </div>
          </div>
        )}
        
        {/* Collections Button if no progress card */}
        {!nextCollectible && (
          <div 
            className="bg-white rounded-xl p-4 mb-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/collections')}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900 mb-1">Card Designs</div>
                <div className="text-xs text-gray-600">View and unlock card designs</div>
              </div>
              <div className="text-espro-orange">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Latest Promotions - Banner Style */}
        {promotions && promotions.length > 0 && (
          <div className="mb-4">
            <div className="font-semibold text-gray-900 mb-3">Latest Promotions</div>
            <div className="space-y-3">
              {promotions.slice(0, 2).map((promo) => (
                <div
                  key={promo._id}
                  className="bg-gradient-to-r from-espro-teal to-espro-orange rounded-xl p-6 text-white cursor-pointer shadow-lg hover:shadow-xl transition-shadow min-h-[120px] flex items-center justify-center"
                  onClick={() => navigate('/promotions')}
                >
                  <div className="text-center">
                    <div className="font-bold text-lg mb-1">{promo.title}</div>
                    {promo.description && (
                      <div className="text-sm opacity-90">{promo.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

