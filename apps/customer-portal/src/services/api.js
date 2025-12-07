import axios from 'axios';

// Get API URL - use environment variable, or detect from current host, or fallback to localhost
function getApiUrl() {
  // If environment variable is set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Detect current host and construct API URL
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // For ngrok: if accessing via ngrok, use the backend ngrok URL from localStorage
  if (hostname.includes('ngrok.io') || hostname.includes('ngrok-free.app')) {
    // Try to get backend ngrok URL from localStorage (set by admin or script)
    const backendNgrokUrl = localStorage.getItem('BACKEND_NGROK_URL');
    if (backendNgrokUrl) {
      return backendNgrokUrl;
    }
    // Fallback: assume backend is on same ngrok domain (if using single ngrok instance)
    // This won't work if backend and frontend are on different ngrok URLs
    return `${protocol}//${hostname}/api`;
  }
  
  // For Render deployment: if hostname contains 'render.com' or 'onrender.com', use the backend service URL
  if (hostname.includes('render.com') || hostname.includes('onrender.com')) {
    // Backend service name: espro-backend
    // Render URLs format: service-name.onrender.com
    return `${protocol}//espro-backend.onrender.com/api`;
  }
  
  // If accessing via IP or domain, use the same host with backend port
  // Backend runs on port 8000
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // Use the same hostname but with backend port
    return `${protocol}//${hostname}:8000/api`;
  }
  
  // Fallback to localhost
  return 'http://localhost:8000/api';
}

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// Customer API
export const customerAPI = {
  getProfile: () => api.get('/customer/profile'),
  updateProfile: (data) => api.put('/customer/profile', data),
  getRewards: () => api.get('/customer/rewards'),
  getCollectibles: () => api.get('/customer/collectibles'),
  activateCardDesign: (id) => api.put(`/customer/collectibles/${id}/activate`),
  getPromotions: () => api.get('/customer/promotions'),
  getClaims: () => api.get('/customer/claims'),
  getVouchers: () => api.get('/customer/vouchers'),
};

// Rewards API
export const rewardsAPI = {
  claimReward: (id) => api.post(`/rewards/claim/${id}`),
};

export const settingsAPI = {
  getPublicSettings: () => api.get('/settings/public'),
};

export default api;

