import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../services/api';
import Toast from '../components/Toast';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setToast({
        isOpen: true,
        message: 'Invalid reset link. Please request a new password reset.',
        type: 'error',
      });
    }
  }, [token]);

  const resetPasswordMutation = useMutation({
    mutationFn: ({ token, password }) => authAPI.resetPassword(token, password),
    onSuccess: (data) => {
      setToast({
        isOpen: true,
        message: data.data.message || 'Password has been reset successfully. You can now login with your new password.',
        type: 'success',
      });
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    },
    onError: (error) => {
      setToast({
        isOpen: true,
        message: error.response?.data?.message || 'Failed to reset password. The link may have expired.',
        type: 'error',
      });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!token) {
      setToast({
        isOpen: true,
        message: 'Invalid reset link. Please request a new password reset.',
        type: 'error',
      });
      return;
    }

    if (password.length < 6) {
      setToast({
        isOpen: true,
        message: 'Password must be at least 6 characters long',
        type: 'error',
      });
      return;
    }

    if (password !== confirmPassword) {
      setToast({
        isOpen: true,
        message: 'Passwords do not match',
        type: 'error',
      });
      return;
    }

    resetPasswordMutation.mutate({ token, password });
  };

  const getPasswordStrength = (pwd) => {
    if (pwd.length === 0) return { strength: 0, label: '', color: '' };
    if (pwd.length < 6) return { strength: 1, label: 'Weak', color: 'bg-red-500' };
    if (pwd.length < 10) return { strength: 2, label: 'Medium', color: 'bg-yellow-500' };
    return { strength: 3, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(password);

  if (!token) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Reset Link</h1>
          <p className="text-gray-600 mb-6">The password reset link is invalid or missing.</p>
          <Link to="/forgot-password" className="text-espro-orange font-semibold hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

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
            Reset Password
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Enter your new password below
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-espro-orange focus:ring-2 focus:ring-espro-orange/20 transition-all outline-none"
                />
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${passwordStrength.color} transition-all`}
                          style={{ width: `${(passwordStrength.strength / 3) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{passwordStrength.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">Password must be at least 6 characters long</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:border-espro-orange focus:ring-2 focus:ring-espro-orange/20 transition-all outline-none"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={resetPasswordMutation.isLoading || !password || !confirmPassword}
                className="w-full bg-gray-900 text-white py-4 rounded-xl font-semibold text-base shadow-md hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resetPasswordMutation.isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Resetting...</span>
                  </>
                ) : (
                  'Reset Password'
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

