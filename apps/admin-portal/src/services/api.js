import axios from 'axios';

// Get API URL - use environment variable, or detect from current host, or fallback to localhost
// Works with Render deployment
function getApiUrl() {
  // If environment variable is set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Detect current host and construct API URL
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // For Render deployment: if hostname contains 'render.com' or 'onrender.com', use the backend service URL
  if (hostname.includes('render.com') || hostname.includes('onrender.com')) {
    // Backend service name: espro-backend
    // Render URLs format: service-name.onrender.com
    return `${protocol}//espro-backend.onrender.com/api`;
  }
  
  // If accessing via IP or domain (local deployment), use the same host with backend port
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

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getCustomers: (params) => api.get('/admin/customers', { params }),
  getCustomer: (id) => api.get(`/admin/customers/${id}`),
  updateCustomerPoints: (id, data) => api.put(`/admin/customers/${id}/points`, data),
  uploadPoints: (file) => {
    const formData = new FormData();
    formData.append('csv', file);
    return api.post('/admin/points-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  syncOdooPoints: () => api.post('/admin/sync-odoo-points'),
  getOdooSyncStatus: () => api.get('/admin/odoo-sync-status'),
  getLoyaltyIds: (params) => api.get('/admin/loyalty-ids', { params }),
  createLoyaltyId: (loyaltyId) => api.post('/admin/loyalty-ids', { loyaltyId }),
  uploadLoyaltyIds: (file) => {
    const formData = new FormData();
    formData.append('csv', file);
    return api.post('/admin/loyalty-ids-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getRewards: (params) => api.get('/admin/rewards', { params }),
  getRedemptionHistory: (params) => api.get('/admin/redemption-history', { params }),
  getQueueStatus: () => api.get('/admin/queue-status'),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  updateSettingsWithLogo: (formData) => api.put('/admin/settings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/admin/settings/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const rewardsAPI = {
  getAll: () => api.get('/rewards'),
  create: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== null && data[key] !== undefined) {
        if (key === 'image' || key === 'voucherImage' || key === 'voucherCodes') {
          if (data[key]) formData.append(key, data[key]);
        } else {
          formData.append(key, data[key]);
        }
      }
    });
    return api.post('/rewards', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== null && data[key] !== undefined) {
        if (key === 'image' || key === 'voucherImage' || key === 'voucherCodes') {
          if (data[key]) formData.append(key, data[key]);
        } else {
          formData.append(key, data[key]);
        }
      }
    });
    return api.put(`/rewards/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id) => api.delete(`/rewards/${id}`),
};

export const promotionsAPI = {
  getAll: () => api.get('/promotions/admin'),
  create: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== null && data[key] !== undefined) {
        if (key === 'image') {
          if (data[key]) formData.append(key, data[key]);
        } else {
          formData.append(key, data[key]);
        }
      }
    });
    return api.post('/promotions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== null && data[key] !== undefined) {
        if (key === 'image') {
          if (data[key]) formData.append(key, data[key]);
        } else {
          formData.append(key, data[key]);
        }
      }
    });
    return api.put(`/promotions/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id) => api.delete(`/promotions/${id}`),
};

export const collectiblesAPI = {
  getAll: () => api.get('/collectibles/admin'),
  create: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== null && data[key] !== undefined) {
        if (key === 'image') {
          if (data[key]) formData.append(key, data[key]);
        } else {
          formData.append(key, data[key]);
        }
      }
    });
    return api.post('/collectibles', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== null && data[key] !== undefined) {
        if (key === 'image') {
          if (data[key]) formData.append(key, data[key]);
        } else {
          formData.append(key, data[key]);
        }
      }
    });
    return api.put(`/collectibles/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id) => api.delete(`/collectibles/${id}`),
};

export const aiAPI = {
  generateColors: (baseColor) => api.post('/ai/generate-colors', { baseColor }),
  generateImage: (prompt, style) => api.post('/ai/generate-image', { prompt, style }),
  getCardDimensions: () => api.get('/ai/card-dimensions'),
};

export default api;

