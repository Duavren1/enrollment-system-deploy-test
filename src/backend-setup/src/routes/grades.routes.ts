import express from 'express';
import {
  getStudentGrades,
  getMyGrades,
  updateGrade,
  bulkUpdateGrades,
  getGradesBySection,
  getPendingGrades,
  approveGrade,
  rejectGrade,
  getApprovedGrades,
  getSubmittedGrades
} from '../controllers/grades.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = express.Router();

// Student fetches own grades (secure — derives student from JWT)
router.get('/my-grades', authenticate, authorize('student'), getMyGrades);
router.get('/student/:studentId', authenticate, authorize('admin', 'superadmin', 'registrar', 'dean'), getStudentGrades);
router.put('/:id', authenticate, authorize('admin', 'superadmin', 'registrar'), updateGrade);
router.post('/bulk', authenticate, authorize('admin', 'superadmin', 'registrar'), bulkUpdateGrades);
router.get('/section', authenticate, authorize('admin', 'superadmin', 'registrar', 'dean'), getGradesBySection);
router.get('/pending', authenticate, authorize('dean', 'admin', 'superadmin'), getPendingGrades);
router.get('/approved', authenticate, authorize('registrar', 'admin', 'superadmin'), getApprovedGrades);
router.get('/submitted', authenticate, authorize('registrar', 'admin', 'superadmin'), getSubmittedGrades);
router.post('/:id/approve', authenticate, authorize('dean', 'admin', 'superadmin'), (req, res, next) => require('../controllers/grades.controller').approveGrade(req, res).catch(next));
router.post('/:id/reject', authenticate, authorize('dean', 'admin', 'superadmin'), (req, res, next) => require('../controllers/grades.controller').rejectGrade(req, res).catch(next));

export default router;
