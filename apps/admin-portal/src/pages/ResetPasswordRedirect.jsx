import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function ResetPasswordRedirect() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    // Redirect to customer portal reset password page
    // Default to localhost:8080 for customer portal (Docker) or 5173 for Vite dev
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const customerPortalUrl = isDev 
      ? (window.location.port === '8081' ? 'http://localhost:8080' : 'http://localhost:5173')
      : (import.meta.env.VITE_CUSTOMER_PORTAL_URL || 'http://localhost:8080');
    
    const resetUrl = `${customerPortalUrl}/reset-password${token ? `?token=${token}` : ''}`;
    window.location.href = resetUrl;
  }, [token]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Redirecting to password reset page...</p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-espro-orange mx-auto"></div>
      </div>
    </div>
  );
}

