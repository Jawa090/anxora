export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const BASE_URL = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : 'http://localhost:4000';
