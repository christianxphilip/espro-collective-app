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
  
  // For production (non-localhost), don't add port
  // Backend should be proxied or accessible on same domain
  // If backend is on different service (like Render), VITE_API_URL should be set
  return `${protocol}//${hostname}`;
}

