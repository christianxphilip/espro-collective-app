import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../services/api';
import Toast from '../components/Toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const forgotPasswordMutation = useMutation({
    mutationFn: (email) => authAPI.forgotPassword(email),
    onSuccess: (data) => {
      setIsSubmitting(false);
      setToast({
        isOpen: true,
        message: data.data.message || 'If an account with that email exists, a password reset link has been sent.',
        type: 'success',
      });
      // Clear email field
      setEmail('');
    },
    onError: (error) => {
      setIsSubmitting(false);
      setToast({
        isOpen: true,
        message: error.response?.data?.message || 'An error occurred. Please try again later.',
        type: 'error',
      });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setToast({
        isOpen: true,
        message: 'Please enter your email address',
        type: 'error',
      });
      return;
    }
    setIsSubmitting(true); // Set loading immediately
    forgotPasswordMutation.mutate(email);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-espro-orange rounded-2xl mb-6 shadow-lg shadow-espro-orange/20">
            <span className="text-white text-4xl font-bold">E</span>
          </div>
          <div className="mb-2">
            <div className="text-gray-400 text-sm font-light tracking-wider uppercase mb-1">
              ESPRO Collective
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Forgot Password?
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-espro-orange focus:ring-2 focus:ring-espro-orange/20 transition-all outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || forgotPasswordMutation.isLoading}
                className="w-full bg-gray-900 text-white py-4 rounded-xl font-semibold text-base shadow-md hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {(isSubmitting || forgotPasswordMutation.isLoading) ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Sending...</span>
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Remember your password?{' '}
                <Link to="/login" className="text-espro-orange font-semibold hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </div>
  );
}

