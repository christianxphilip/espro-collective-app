import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function QRCodeView() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-transparent px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="text-base font-bold text-gray-900">QR Code</div>
              <div className="text-sm text-gray-600">Show at checkout</div>
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
        {/* QR Code Display */}
        <div className="text-center mb-8">
          <div className="text-xs text-gray-600 mb-6 tracking-wider uppercase">Scan QR Code</div>
          
          <div className="bg-white rounded-3xl p-8 shadow-2xl inline-block mb-6">
            <QRCodeSVG value={user?.loyaltyId || ''} size={240} level="H" />
          </div>
          
          <div className="mt-6">
            <div className="font-mono text-base tracking-wider text-gray-900 font-semibold mb-1">{user?.loyaltyId || 'N/A'}</div>
            <div className="text-xs text-gray-600">Loyalty ID</div>
          </div>
        </div>

        {/* Instructions Card */}
        <div className="bg-espro-cream rounded-xl p-4 border-l-4 border-espro-orange">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-espro-orange rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">!</div>
            <div>
              <div className="font-semibold mb-2 text-gray-900">How to use</div>
              <div className="text-sm text-gray-700 leading-relaxed">
                Show this QR code to staff at checkout to earn espro coins. The QR code contains your Loyalty ID.
              </div>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="w-full bg-espro-orange text-white py-4 rounded-xl font-semibold mt-6 shadow-lg hover:shadow-xl transition-shadow"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

