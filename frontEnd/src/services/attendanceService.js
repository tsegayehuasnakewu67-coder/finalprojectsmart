import api from './api';

export const attendanceService = {
  startLivenessChallenge: async ()         => (await api.post('/attendance/liveness/challenge')).data.data,
  mark:           async (faceDescriptor, livenessProof) => (await api.post('/attendance/scan', { faceDescriptor, livenessProof })).data,
  checkout:       async (faceDescriptor, livenessProof) => (await api.post('/attendance/checkout', { faceDescriptor, livenessProof })).data,
  getKioskStatus: async ()               => (await api.get('/attendance/kiosk-status')).data.data,
  getCompany:     async (params = {})    => (await api.get('/reports',                  { params })).data.data,
  getMine:        async (params = {})    => (await api.get('/attendance/my',            { params })).data.data,
  getDashboard:   async ()               => (await api.get('/attendance/dashboard', { timeout: 60000 })).data.data,
  getMyStats:     async ()               => (await api.get('/attendance/my/stats')).data.data,
  getAnalytics:   async (params = {})    => (await api.get('/reports/analytics',        { params })).data.data,
};
