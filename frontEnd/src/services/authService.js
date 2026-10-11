import api from './api';

export const authService = {
  login:    async (identifier, password) => (await api.post('/auth/login', { identifier, password })).data.data,
  register: async (payload)               => (await api.post('/auth/register', payload)).data.data,
  getMe:    async ()                      => (await api.get('/auth/me')).data.data,
};
