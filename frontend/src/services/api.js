import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const TOKEN_STORAGE_KEY = 'shopgenie_token';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the auth token (if present) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Broadcast a logout event if the backend ever tells us the session is invalid,
// so AuthContext can clear state and redirect to Login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('shopgenie:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (payload) => api.post('/auth/register', payload).then((res) => res.data),
  verifyOtp: (payload) => api.post('/auth/verify-otp', payload).then((res) => res.data),
  resendOtp: (payload) => api.post('/auth/resend-otp', payload).then((res) => res.data),
  login: (payload) => api.post('/auth/login', payload).then((res) => res.data),
  me: () => api.get('/auth/me').then((res) => res.data),
  logout: () => api.post('/auth/logout').then((res) => res.data),
};

export const TOKEN_KEY = TOKEN_STORAGE_KEY;

export const productAPI = {
  list: (params = {}) => api.get('/products', { params }).then((res) => res.data),
  get: (id) => api.get(`/products/${id}`).then((res) => res.data),
};

export const cartAPI = {
  get: () => api.get('/cart').then((res) => res.data),
  add: (productId, quantity = 1) => api.post('/cart/items', { product_id: productId, quantity }).then((res) => res.data),
  update: (productId, quantity) => api.put(`/cart/items/${productId}`, { quantity }).then((res) => res.data),
  remove: (productId) => api.delete(`/cart/items/${productId}`).then((res) => res.data),
  clear: () => api.delete('/cart').then((res) => res.data),
};

export const agentAPI = {
  chat: (message, lastRecommendedId = null) => 
    api.post('/agent/chat', { message, last_recommended_id: lastRecommendedId }).then((res) => res.data),
  getRecommendations: () => api.get('/agent/recommendations').then((res) => res.data),
};

export const paymentAPI = {
  createOrder: () => api.post('/payment/create-order').then((res) => res.data),
  verify: (data) => api.post('/payment/verify', data).then((res) => res.data),
  cancel: (data) => api.post('/payment/cancel', data).then((res) => res.data),
  fail: (data) => api.post('/payment/fail', data).then((res) => res.data),
  getOrders: () => api.get('/payment/orders').then((res) => res.data),
};

export default api;
