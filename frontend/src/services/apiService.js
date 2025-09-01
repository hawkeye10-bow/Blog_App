import axios from 'axios';
import { serverURL } from '../helper/Helper';
import { store } from '../store/index.js';

// Create axios instance
const api = axios.create({
  baseURL: serverURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth headers
api.interceptors.request.use(
  (config) => {
    // Get user ID from Redux store
    const state = store.getState();
    const userId = state.user?._id || localStorage.getItem('userId');
    
    if (userId) {
      // Send user ID in multiple header formats to ensure compatibility
      config.headers['user-id'] = userId;
      config.headers['userid'] = userId;
      config.headers['x-user-id'] = userId;
      
      // Also add to query params for GET requests
      if (config.method === 'get' && config.params) {
        config.params.userId = userId;
      }
      
      // Also add to body for POST/PUT requests
      if (config.method === 'post' || config.method === 'put') {
        if (!config.data) config.data = {};
        config.data.userId = userId;
      }
      
      console.log('🔐 API Request - User ID set:', userId);
      console.log('🔐 API Request - Headers:', config.headers);
    } else {
      console.log('⚠️ API Request - No user ID found');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.log('❌ API Response Error:', error.response?.status, error.response?.data);
    
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      console.log('🚫 Unauthorized - redirecting to login');
      localStorage.removeItem('userId');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

export default api;
