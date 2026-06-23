import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5001/api', // Pointing to the backend running locally
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
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

// Response interceptor to handle 401s (Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Temporarily disabled so you don't get forced to the login page while testing:
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
