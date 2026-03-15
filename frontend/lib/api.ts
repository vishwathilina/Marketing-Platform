import axios from 'axios';

// Use Next.js rewrite proxy to avoid CORS issues
// Requests to /api/* are proxied to http://localhost:8000/*
const API_BASE_URL = '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authApi = {
    register: async (email: string, password: string) => {
        const response = await api.post('/auth/register', { email, password });
        return response.data;
    },

    login: async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        const { access_token } = response.data;
        localStorage.setItem('token', access_token);
        return response.data;
    },

    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    logout: () => {
        localStorage.removeItem('token');
    },
};

// Projects API
export const projectsApi = {
    list: async () => {
        const response = await api.get('/projects');
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get(`/projects/${id}`);
        return response.data;
    },

    create: async (formData: FormData) => {
        const response = await api.post('/projects', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/projects/${id}`);
    },
};

// Simulations API
export const simulationsApi = {
    start: async (projectId: string, config?: { num_agents?: number; simulation_days?: number }) => {
        const response = await api.post(`/simulations/${projectId}/start`, config || {});
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get(`/simulations/${id}`);
        return response.data;
    },

    getStatus: async (id: string) => {
        const response = await api.get(`/simulations/${id}/status`);
        return response.data;
    },

    getResults: async (id: string) => {
        const response = await api.get(`/simulations/${id}/results`);
        return response.data;
    },

    listForProject: async (projectId: string) => {
        const response = await api.get(`/simulations/project/${projectId}`);
        return response.data;
    },
};

export default api;
