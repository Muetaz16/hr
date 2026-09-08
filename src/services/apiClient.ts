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
        // For file uploads, drop the default JSON content-type so the browser sets
        // multipart/form-data with the correct boundary (otherwise multer sees no file).
        if (config.data instanceof FormData) {
            const h: any = config.headers;
            if (h && typeof h.delete === 'function') h.delete('Content-Type');
            else if (h) delete h['Content-Type'];
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

/**
 * Absolute URL for a stored file.
 *
 * Uploads are saved as server-relative paths ("/uploads/documents/x.pdf") and served by Express,
 * NOT by the app's own origin. Putting one straight into an href resolves it against the frontend
 * instead, which in dev hits Vite's SPA fallback: the browser gets index.html, the router sees an
 * unknown path, and the user lands on a blank route rather than their document.
 *
 * Returns null for a missing path so a caller can decide not to render the link at all.
 */
export const fileUrl = (path?: string | null): string | null => {
    if (!path) return null;
    // An already-absolute URL (or a data: blob) is handed back untouched.
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return `${SERVER_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

export default api;
