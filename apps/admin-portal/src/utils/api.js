/**
 * Get the base API URL (without /api suffix)
 * Detects from current host when accessing via IP/domain
 */
export function getBaseApiUrl() {
  // If environment variable is set, use it (remove /api if present)
  if (import.meta.env.VITE_API_URL) {
    let apiUrl = import.meta.env.VITE_API_URL.replace('/api', '');
    // Remove trailing slash if present
    apiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    // Ensure it doesn't have a port number in production (Render services don't use ports in URLs)
    // Remove port if it's :8000 and we're not on localhost
    if (apiUrl.includes(':8000') && !apiUrl.includes('localhost')) {
      apiUrl = apiUrl.replace(':8000', '');
    }
    return apiUrl;
  }
  
  // Detect current host and construct API URL
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // In production (Render, etc.), backend is typically on the same domain or proxied
  // Only add port for localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  
  // For production (non-localhost), try to detect backend service
  // On Render, if VITE_API_URL is not set, try to construct backend URL
  if (hostname.includes('render.com') || hostname.includes('onrender.com')) {
    // Try to detect backend service name from hostname
    // If frontend is espro-admin-portal.onrender.com, backend might be espro-backend.onrender.com
    // This is a fallback - VITE_API_URL should be set in production
    const serviceName = hostname.split('.')[0];
    if (serviceName.includes('admin') || serviceName.includes('customer')) {
      // Replace admin-portal or customer-portal with backend
      const backendService = serviceName.replace(/-portal$/, '').replace(/-admin$/, '').replace(/-customer$/, '') + '-backend';
      return `${protocol}//${backendService}.onrender.com`;
    }
    // Fallback: assume backend service name is 'espro-backend'
    return `${protocol}//espro-backend.onrender.com`;
  }
  
  // For other production environments, assume backend is on same domain
  // Backend should be proxied or accessible on same domain
  // If backend is on different service, VITE_API_URL should be set
  return `${protocol}//${hostname}`;
}

