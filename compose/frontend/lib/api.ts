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

const AUTH_TOKEN_KEY = 'token';
const AUTH_COOKIE_NAME = 'auth_token';

const getCookieValue = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
};

export const getStoredToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    const localToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (localToken && localToken !== 'undefined' && localToken !== 'null') {
        return localToken;
    }
    return getCookieValue(AUTH_COOKIE_NAME);
};

export const setStoredToken = (token: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=86400`;
};

export const clearStoredToken = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
};

// Add auth token to requests
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = getStoredToken();
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
                clearStoredToken();
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
        if (access_token) {
            setStoredToken(access_token);
        }
        return response.data;
    },

    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    logout: () => {
        clearStoredToken();
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

    updateContext: async (id: string, context: string) => {
        const response = await api.patch(`/projects/${id}/context`, { vlm_generated_context: context });
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/projects/${id}`);
    },
};

// Simulations API
export const simulationsApi = {
    start: async (projectId: string, config?: { num_agents?: number; simulation_days?: number; agent_ids?: string[]; use_custom_agents_only?: boolean; demographic_filter?: any }) => {
        const response = await api.post(`/simulations/${projectId}/start`, config || {});
        return response.data;
    },

    cancel: async (id: string) => {
        const response = await api.post(`/simulations/${id}/cancel`);
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

    getMapData: async (id: string) => {
        const response = await api.get(`/simulations/${id}/map-data`);
        return response.data;
    },

    getAgentDetail: async (id: string, agentId: string) => {
        const response = await api.get(`/simulations/${id}/agents/${agentId}`);
        return response.data;
    },

};

// Custom Agents API
export const agentsApi = {
    list: async () => {
        const response = await api.get('/agents');
        return response.data;
    },
    get: async (id: string) => {
        const response = await api.get(`/agents/${id}`);
        return response.data;
    },
    create: async (agentData: any) => {
        const response = await api.post('/agents', agentData);
        return response.data;
    },
    update: async (id: string, agentData: any) => {
        const response = await api.put(`/agents/${id}`, agentData);
        return response.data;
    },
    delete: async (id: string) => {
        await api.delete(`/agents/${id}`);
    },
};

export default api;
