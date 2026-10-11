import api from './api';

const normalizeCollectionResponse = (payload = {}) => {
  const employees = payload.employees ?? payload.users ?? [];
  const pagination = payload.pagination ?? {
    total: employees.length,
    page: 1,
    limit: employees.length || 1,
    totalPages: 1,
  };

  return { employees, pagination };
};

const normalizeSingleResponse = (payload = {}) => payload.user ?? payload.employee ?? payload;

export const userService = {
  getAll: async (params = {}) => {
    const { data } = await api.get('/users', { params });
    return normalizeCollectionResponse(data?.data ?? data);
  },

  getById: async (id) => {
    const { data } = await api.get(`/users/${id}`);
    return normalizeSingleResponse(data?.data ?? data);
  },

  create: async (payload) => {
    const { data } = await api.post('/employees', payload);
    return data?.data?.employee ?? data?.data?.user ?? data?.data ?? data;
  },

  update: async (id, payload) => {
    const { data } = await api.put(`/users/${id}`, payload);
    return normalizeSingleResponse(data?.data ?? data);
  },

  updateEmployee: async (id, payload) => {
    const { data } = await api.put(`/employees/${id}`, payload);
    return data?.data?.employee ?? data?.data ?? data;
  },

  registerFace: async (payload) => {
    const { data } = await api.post('/face/register', payload);
    return data?.data?.employee ?? data?.data ?? data;
  },

  remove: async (id) => (await api.delete(`/users/${id}`)).data,
  resetPassword: async (id) => (await api.post(`/users/${id}/reset-password`)).data,
  updateFace: async (id, faceDescriptor) => (await api.patch(`/users/${id}/face`, { faceDescriptor })).data.data.user,
  getDepartments: async () => (await api.get('/users/departments')).data.data.departments,

  getUnlinkedEmployees: async (params = {}) => {
    const { data } = await api.get('/employees', { params: { ...params, unlinked: true } });
    return normalizeCollectionResponse(data?.data ?? data);
  },

  removeEmployeeProfile: async (id) => (await api.delete(`/employees/${id}`)).data,

  previewEmployeeImport: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/employees/bulk/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return data.data;
  },

  importEmployees: async (rows, requireFace = false) => {
    const { data } = await api.post('/employees/bulk/import', { rows, requireFace }, { timeout: 60000 });
    return data.data;
  },
};
