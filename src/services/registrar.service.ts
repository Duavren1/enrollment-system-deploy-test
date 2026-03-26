import api, { handleApiError } from '../utils/api';

class RegistrarService {
  async assignSection(enrollmentId: number, sectionId: number): Promise<any> {
    try {
      const response = await api.post('/registrar/sections/assign', { enrollment_id: enrollmentId, section_id: sectionId });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async getEnrollmentReport(): Promise<any> {
    try {
      const response = await api.get('/registrar/reports/enrollments');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async getDashboardStats(): Promise<any> {
    try {
      const response = await api.get('/registrar/dashboard/stats');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // CORs
  async getAllCORs(filters?: {
    status?: string;
    studentId?: string;
  }): Promise<any> {
    try {
      const response = await api.get('/registrar/cors', { params: filters });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async generateCOR(enrollmentId: number): Promise<any> {
    try {
      const response = await api.post('/registrar/cors/generate', { enrollmentId });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async approveCOR(id: number): Promise<any> {
    try {
      const response = await api.put(`/registrar/cors/${id}/approve`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Clearances
  async getAllClearances(filters?: {
    status?: string;
    clearance_type?: string;
    studentId?: string;
  }): Promise<any> {
    try {
      const response = await api.get('/registrar/clearances', { params: filters });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async createClearance(clearanceData: {
    student_id: number;
    clearance_type: string;
    issue_description?: string;
  }): Promise<any> {
    try {
      const response = await api.post('/registrar/clearances', clearanceData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async resolveClearance(id: number, remarks?: string): Promise<any> {
    try {
      const response = await api.put(`/registrar/clearances/${id}/resolve`, { remarks });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Subject Assessment (new step after subject selection)
  async getPendingSubjectAssessments(): Promise<any> {
    try {
      const response = await api.get('/registrar/enrollments/pending-assessment');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async getEnrollmentAssessmentDetails(enrollmentId: number): Promise<any> {
    try {
      const response = await api.get(`/registrar/enrollments/${enrollmentId}/assessment-details`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async approveSubjectAssessment(
    enrollmentId: number,
    assessmentData: {
      tuition?: number;
      registration?: number;
      library?: number;
      lab?: number;
      id_fee?: number;
      others?: number;
      remarks?: string;
    }
  ): Promise<any> {
    try {
      const response = await api.put(`/registrar/enrollments/${enrollmentId}/approve-assessment`, assessmentData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Assess enrollment and set fees
   */
  async assessEnrollment(
    enrollmentId: number,
    assessmentData: {
      tuition: number;
      registration: number;
      library: number;
      lab: number;
      id_fee: number;
      others: number;
      remarks?: string;
    }
  ): Promise<any> {
    try {
      const response = await api.put(`/registrar/enrollments/${enrollmentId}/assess`, assessmentData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Verify payment
   */
  async verifyPayment(
    enrollmentId: number,
    verificationData: {
      transaction_id: number;
      remarks?: string;
    }
  ): Promise<any> {
    try {
      const response = await api.put(`/registrar/enrollments/${enrollmentId}/verify-payment`, verificationData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Approve enrollment (moves to "For Subject Selection")
   */
  async approveEnrollment(enrollmentId: number, remarks?: string): Promise<any> {
    try {
      const response = await api.put(`/registrar/enrollments/${enrollmentId}/approve`, { remarks });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Reject enrollment
   */
  async rejectEnrollment(enrollmentId: number, remarks?: string): Promise<any> {
    try {
      const response = await api.put(`/registrar/enrollments/${enrollmentId}/reject`, { remarks });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // ── Subject Management (Adding / Dropping) ──

  async searchEnrolledStudents(search?: string, status?: string): Promise<any> {
    try {
      const response = await api.get('/registrar/subject-management/search', {
        params: { search, status }
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async getEnrollmentSubjectsForEdit(enrollmentId: number): Promise<any> {
    try {
      const response = await api.get(`/registrar/subject-management/${enrollmentId}/subjects`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async registrarAddSubject(enrollmentId: number, subjectId: number, reason?: string): Promise<any> {
    try {
      const response = await api.post(`/registrar/subject-management/${enrollmentId}/add-subject`, {
        subject_id: subjectId, reason
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async registrarDropSubject(enrollmentId: number, subjectId: number, reason?: string): Promise<any> {
    try {
      const response = await api.delete(`/registrar/subject-management/${enrollmentId}/drop-subject/${subjectId}`, {
        data: { reason }
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async getSubjectAuditTrail(enrollmentId: number): Promise<any> {
    try {
      const response = await api.get(`/registrar/subject-management/${enrollmentId}/audit-trail`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // ─── Requirements Management ───

  async getRequirementsForReview(params?: { status?: string; type?: string }): Promise<any> {
    try {
      const response = await api.get('/requirements/registrar/list', { params });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async updateRequirementStatus(id: number | string, data: { status: string; remarks?: string }): Promise<any> {
    try {
      const response = await api.put(`/requirements/registrar/${id}/status`, data);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async confirmHardCopyReceipt(id: number | string): Promise<any> {
    try {
      const response = await api.put(`/requirements/registrar/${id}/hard-copy-confirm`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async getCreditingRequests(params?: { status?: string }): Promise<any> {
    try {
      const response = await api.get('/requirements/registrar/crediting', { params });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async reviewCreditingRequest(id: number, data: { status: string; registrar_remarks?: string }): Promise<any> {
    try {
      const response = await api.put(`/requirements/registrar/crediting/${id}`, data);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }


}

export const registrarService = new RegistrarService();
