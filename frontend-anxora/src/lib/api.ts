export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const BASE_URL = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : 'http://localhost:4000';

// Simple API wrapper
export const api = {
    async get(endpoint: string, options?: { params?: Record<string, any> }) {
        const url = new URL(`${BASE_URL}${endpoint}`);
        if (options?.params) {
            Object.entries(options.params).forEach(([key, value]) => {
                url.searchParams.append(key, String(value));
            });
        }
        const token = localStorage.getItem('token');
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
    },
    async post(endpoint: string, body?: any) {
        const token = localStorage.getItem('token');
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
    },
};
