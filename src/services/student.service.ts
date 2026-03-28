import api, { handleApiError } from '../utils/api';

class StudentService {
  /**
   * Get student profile
   */
  async getProfile(): Promise<any> {
    try {
      const response = await api.get('/students/profile');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async listNotifications(): Promise<any> {
    try {
      const response = await api.get('/notifications');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async markNotificationRead(id: number | string): Promise<any> {
    try {
      const response = await api.post(`/notifications/${id}/read`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Update student profile
   */
  async updateProfile(profileData: {
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    suffix?: string;
    email?: string;
    contact_number?: string;
    address?: string;
    birth_date?: string;
    gender?: string;
    username?: string;
    course?: string;
    year_level?: number;
  }): Promise<any> {
    try {
      const response = await api.put('/students/profile', profileData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Change password
   */
  async changePassword(newPassword: string): Promise<any> {
    try {
      const response = await api.put('/auth/change-password', {
        newPassword
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get curriculum checklist for the student's program with grades
   */
  async getCurriculumChecklist(): Promise<any> {
    try {
      const response = await api.get('/students/curriculum-checklist');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get student enrollments
   */
  async getEnrollments(): Promise<any> {
    try {
      const response = await api.get('/students/enrollments');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Upload document
   */
  async uploadDocument(
    file: File,
    documentType: string,
    enrollmentId?: number
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('document_type', documentType);
      if (enrollmentId) {
        formData.append('enrollment_id', enrollmentId.toString());
      }

      const response = await api.post('/students/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Submit installment payment
   */
  async submitInstallmentPayment(data: {
    enrollmentId: number;
    studentId: number;
    amount: number;
    period: string;
    paymentMethod: string;
    referenceNumber: string;
    receiptPath?: string;
  }): Promise<any> {
    try {
      const response = await api.post('/payments/installment', data);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get installment payment schedule for an enrollment
   */
  async getInstallmentSchedule(enrollmentId: number): Promise<any> {
    try {
      const response = await api.get(`/payments/installment-schedule/${enrollmentId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get documents for an enrollment
   */
  async getEnrollmentDocuments(enrollmentId: number): Promise<any> {
    try {
      const response = await api.get(`/students/documents/enrollment/${enrollmentId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // ─── Requirements ───

  async getRequirements(): Promise<any> {
    try {
      const response = await api.get('/requirements/student/list');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async uploadRequirement(formData: FormData): Promise<any> {
    try {
      const response = await api.post('/requirements/student/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async tagHardCopy(requirementId: number): Promise<any> {
    try {
      const response = await api.put(`/requirements/student/${requirementId}/hard-copy`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async submitOvr(data: { school_year?: string; semester?: string; requested_units: number; reason: string }): Promise<any> {
    try {
      const response = await api.post('/requirements/student/ovr', data);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Submit a promissory note for an installment period
   */
  async submitPromissoryNote(data: {
    enrollment_id: number;
    period: string;
    amount_due: number;
    promised_date: string;
    reason: string;
    file: File;
  }): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('document', data.file);
      formData.append('enrollment_id', data.enrollment_id.toString());
      formData.append('period', data.period);
      formData.append('amount_due', data.amount_due.toString());
      formData.append('promised_date', data.promised_date);
      formData.append('reason', data.reason || '');

      const response = await api.post('/students/promissory-note', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Get promissory notes for an enrollment
   */
  async getPromissoryNotes(enrollmentId: number): Promise<any> {
    try {
      const response = await api.get(`/students/promissory-notes/${enrollmentId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
}

export const studentService = new StudentService();
