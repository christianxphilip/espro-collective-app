import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { formatEsproCoinsDisplay } from '../utils/format';

export default function Profile() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 relative" style={{ minHeight: '100%' }}>
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
          <div className="font-bold text-xl text-gray-900">Profile</div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-4">
        {/* Profile Card - Wallet Style */}
        <div
          className="rounded-2xl p-6 text-white shadow-xl min-h-[120px]"
          style={{
            background: 'linear-gradient(135deg, #f66633 0%, #ff8c64 100%)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-18 h-18 bg-white/30 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0" style={{ width: '70px', height: '70px' }}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <div className="font-bold text-xl mb-1">{user?.name}</div>
              <div className="text-sm opacity-90">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 text-center shadow-sm">
            <div className="text-xs text-gray-600 mb-2 uppercase">Current</div>
            <div className="text-3xl font-bold text-espro-orange">{formatEsproCoinsDisplay(user?.esproCoins || 0)}</div>
            <div className="text-xs text-gray-500 mt-1">espro coins</div>
          </div>
          <div className="bg-white rounded-xl p-5 text-center shadow-sm">
            <div className="text-xs text-gray-600 mb-2 uppercase">Total Earned</div>
            <div className="text-3xl font-bold text-espro-teal">{formatEsproCoinsDisplay(user?.lifetimeEsproCoins || 0)}</div>
            <div className="text-xs text-gray-500 mt-1">espro coins</div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium mb-1 text-gray-900">Loyalty ID</div>
              <div className="font-mono text-sm text-gray-600">{user?.loyaltyId || 'N/A'}</div>
            </div>
            <div className="w-8 h-8 bg-espro-cream rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-espro-orange rounded"></div>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/vouchers')}
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium mb-1 text-gray-900">Vouchers</div>
              <div className="text-sm text-gray-600">View available and used vouchers</div>
            </div>
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 text-espro-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/points-history')}
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium mb-1 text-gray-900">Points History</div>
              <div className="text-sm text-gray-600">View earned and used points</div>
            </div>
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 text-espro-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-espro-orange text-white py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow mt-2"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

