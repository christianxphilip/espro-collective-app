/**
 * Get the base API URL (without /api suffix)
 * Detects from current host when accessing via IP/domain
 */
export function getBaseApiUrl() {
  // If environment variable is set, use it (remove /api if present)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace('/api', '');
  }
  
  // Detect current host and construct API URL
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // If accessing via IP or domain, use the same host with backend port
  // Backend runs on port 8000
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}:8000`;
  }
  
  // Fallback to localhost
  return 'http://localhost:8000';
}
