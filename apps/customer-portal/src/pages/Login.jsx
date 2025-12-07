import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../store/authStore';
import { settingsAPI } from '../services/api';
import { getBaseApiUrl } from '../utils/api';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', referralCode: '' });
  const [loading, setLoading] = useState(false);
  const { login, register, error } = useAuthStore();
  const navigate = useNavigate();
  
  // Fetch settings for logo
  const { data: settingsResponse } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => settingsAPI.getPublicSettings().then((res) => res.data.settings),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  const logoUrl = settingsResponse?.logoUrl 
    ? (settingsResponse.logoUrl.startsWith('http')
        ? settingsResponse.logoUrl
        : `${getBaseApiUrl()}${settingsResponse.logoUrl}`)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let result;
    if (isLogin) {
      result = await login(formData.email, formData.password);
    } else {
      result = await register(formData.name, formData.email, formData.password, formData.referralCode);
    }

    setLoading(false);

    if (result.success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-12">
          {/* Logo Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-espro-orange rounded-2xl mb-6 shadow-lg shadow-espro-orange/20 overflow-hidden">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="ESPRO Collective Logo" 
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  // Fallback to default if image fails to load
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'inline';
                }}
              />
            ) : null}
            <span className={`text-white text-4xl font-bold ${logoUrl ? 'hidden' : ''}`}>E</span>
          </div>
          
          {/* Brand Name */}
          <div className="mb-2">
            <div className="text-gray-400 text-sm font-light tracking-wider uppercase mb-1">
              ESPRO Collective
            </div>
          </div>
          
          {/* Welcome Heading */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Welcome to Your Loyalty Journey
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            {isLogin ? 'Sign in to continue earning rewards' : 'Create your account and start earning'}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
          {/* Form Section */}
          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-espro-orange focus:ring-2 focus:ring-espro-orange/20 transition-all outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-400 text-lg font-medium">@</span>
                  </div>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your.email@example.com"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-espro-orange focus:ring-2 focus:ring-espro-orange/20 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-espro-orange focus:ring-2 focus:ring-espro-orange/20 transition-all outline-none"
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Referral Code <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={formData.referralCode}
                      onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                      placeholder="Enter referral code (e.g., CLUB-XXXX-XXXX)"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-espro-orange focus:ring-2 focus:ring-espro-orange/20 transition-all outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Have a club referral code? Enter it here to unlock exclusive content.
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white py-4 rounded-xl font-semibold text-base shadow-md hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Please wait...</span>
                  </>
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In' : 'Get Started'}</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Footer Text */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {isLogin ? "New customer? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-espro-orange font-semibold hover:underline"
                >
                  {isLogin ? 'Register now' : 'Sign in'}
                </button>
                {isLogin && ' and start earning rewards!'}
              </p>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-xs">
            Join thousands of happy customers
          </p>
        </div>
      </div>
    </div>
  );
}

