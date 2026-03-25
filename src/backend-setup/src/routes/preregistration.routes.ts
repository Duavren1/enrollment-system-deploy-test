import express from 'express';
import {
  getAvailableCourses,
  submitPreRegistration,
  trackPreRegistration,
  getCashierQueue,
  verifyCashierPayment,
  getAdminQueue,
  createAccountFromPreReg,
  getPreRegById,
} from '../controllers/preregistration.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Ensure uploads/receipts directory exists
const receiptsDir = path.join(__dirname, '..', '..', 'uploads', 'receipts');
try { fs.mkdirSync(receiptsDir, { recursive: true }); } catch (e) {}

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, receiptsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/i;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only images (JPG, PNG) and PDF files are allowed'));
  }
});

// ─── Public Endpoints (no auth) ───
router.get('/courses', getAvailableCourses);
router.post('/submit', upload.single('receipt'), submitPreRegistration);
router.get('/track/:referenceId', trackPreRegistration);

// ─── Cashier Endpoints ───
router.get('/cashier/queue', authenticate, authorize('cashier', 'superadmin'), getCashierQueue);
router.put('/cashier/:id/verify', authenticate, authorize('cashier', 'superadmin'), verifyCashierPayment);

// ─── Admin Endpoints ───
router.get('/admin/queue', authenticate, authorize('admin', 'superadmin'), getAdminQueue);
router.post('/admin/:id/create-account', authenticate, authorize('admin', 'superadmin'), createAccountFromPreReg);
router.get('/admin/:id', authenticate, authorize('admin', 'superadmin', 'cashier'), getPreRegById);

export default router;
