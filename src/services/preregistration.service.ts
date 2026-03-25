import api, { API_BASE_URL } from '../utils/api';
import axios from 'axios';

// Public API instance (no auth token needed for pre-registration)
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

class PreRegistrationService {
  // ─── Public Endpoints ───

  async getAvailableCourses(): Promise<any> {
    const response = await publicApi.get('/pre-registration/courses');
    return response.data;
  }

  async submitPreRegistration(formData: FormData): Promise<any> {
    const response = await publicApi.post('/pre-registration/submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
    return response.data;
  }

  async trackApplication(referenceId: string): Promise<any> {
    const response = await publicApi.get(`/pre-registration/track/${referenceId}`);
    return response.data;
  }

  // ─── Cashier Endpoints (auth required) ───

  async getCashierQueue(params?: { status?: string }): Promise<any> {
    const response = await api.get('/pre-registration/cashier/queue', { params });
    return response.data;
  }

  async verifyPayment(id: number, data: { action: 'verify' | 'reject'; remarks?: string }): Promise<any> {
    const response = await api.put(`/pre-registration/cashier/${id}/verify`, data);
    return response.data;
  }

  // ─── Admin Endpoints (auth required) ───

  async getAdminQueue(params?: { status?: string }): Promise<any> {
    const response = await api.get('/pre-registration/admin/queue', { params });
    return response.data;
  }

  async createAccount(id: number, data: { username: string; password: string }): Promise<any> {
    const response = await api.post(`/pre-registration/admin/${id}/create-account`, data);
    return response.data;
  }

  async getPreRegById(id: number): Promise<any> {
    const response = await api.get(`/pre-registration/admin/${id}`);
    return response.data;
  }
}

export const preRegistrationService = new PreRegistrationService();
