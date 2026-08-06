import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add a request interceptor to attach the token
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

// Add a response interceptor to handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const { response } = error;
        const url = error.config?.url || 'unknown url';

        if (response?.status === 401) {
            console.warn(`[API] 401 Unauthorized at ${url}. Clearing session.`);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        } else if (response?.status === 403) {
            console.warn(`[API] 403 Forbidden at ${url}. Access denied but keeping session.`);
            // Don't redirect on 403, just let the component handle the error
            // This prevents "flash logout" when a secondary dashboard call fails
        }
        return Promise.reject(error);
    }
);

export const SERVER_URL = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5001';

export default api;
