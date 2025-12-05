/**
 * Get the base API URL (without /api suffix)
 * Detects from current host when accessing via IP/domain
 * Works with Render deployment
 */
export function getBaseApiUrl() {
  // If environment variable is set, use it (remove /api if present)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace('/api', '');
  }
  
  // Detect current host and construct API URL
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // For Render deployment: if hostname contains 'render.com' or 'onrender.com', use the backend service URL
  if (hostname.includes('render.com') || hostname.includes('onrender.com')) {
    // Backend service name: espro-backend
    // Render URLs format: service-name.onrender.com
    return `${protocol}//espro-backend.onrender.com`;
  }
  
  // For ngrok: if accessing via ngrok, use the backend ngrok URL from environment or localStorage
  if (hostname.includes('ngrok.io') || hostname.includes('ngrok-free.app')) {
    // Try to get backend ngrok URL from localStorage (set by admin or script)
    const backendNgrokUrl = localStorage.getItem('BACKEND_NGROK_URL');
    if (backendNgrokUrl) {
      return backendNgrokUrl.replace('/api', '');
    }
    // Fallback: assume backend is on same ngrok domain (if using single ngrok instance)
    // This won't work if backend and frontend are on different ngrok URLs
    return `${protocol}//${hostname}`;
  }
  
  // If accessing via IP or domain (local deployment), use the same host with backend port
  // Backend runs on port 8000
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}:8000`;
  }
  
  // Fallback to localhost
  return 'http://localhost:8000';
}

