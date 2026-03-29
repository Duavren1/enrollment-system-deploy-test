import { Request, Response } from 'express';
import { query, run, get } from '../database/connection';
import { AuthRequest } from '../middleware/auth.middleware';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Helper to log activities
const logActivity = async (user: string, action: string, meta?: any) => {
  try {
    const dataDir = path.join(__dirname, '../../data');
    fs.mkdirSync(dataDir, { recursive: true });
    const logsFile = path.join(dataDir, 'activityLogs.json');
    let logs = [];
    try {
      logs = JSON.parse(fs.readFileSync(logsFile, 'utf8') || '[]');
    } catch (e) {
      logs = [];
    }
    logs.unshift({
      id: Date.now(),
      user: user || 'system',
      action: action,
      meta: meta || null,
      ts: new Date().toISOString()
    });
    fs.writeFileSync(logsFile, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
};

// Generate a human-readable reference ID like "PRE-2026-ABCD1234"
const generateReferenceId = (): string => {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PRE-${year}-${code}`;
};

// ─── PUBLIC ENDPOINTS (no auth) ───

/**
 * Get available courses and their fee rates for the pre-registration form
 */
export const getAvailableCourses = async (req: Request, res: Response) => {
  try {
    const courses = await query(
      `SELECT course, tuition_per_unit, registration, library, lab, id_fee, others, installment_fee FROM courses_fees ORDER BY course`
    );

    // If no courses_fees rows exist, return defaults
    if (!courses || courses.length === 0) {
      return res.json({
        success: true,
        data: [
          { course: 'BSIT', tuition_per_unit: 700, registration: 1500, library: 500, lab: 2000, id_fee: 200, others: 300, installment_fee: 500 },
          { course: 'BSCS', tuition_per_unit: 700, registration: 1500, library: 500, lab: 2000, id_fee: 200, others: 300, installment_fee: 500 },
        ]
      });
    }

    res.json({ success: true, data: courses });
  } catch (error: any) {
    console.error('Get available courses error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Submit a pre-registration application (Phase 1 + Phase 2)
 * Public endpoint — no auth required
 */
export const submitPreRegistration = async (req: Request, res: Response) => {
  try {
    const {
      // Phase 1 fields
      first_name, middle_name, last_name, suffix,
      email, contact_number, birth_date, gender, address,
      admission_type, source_of_awareness,
      learning_modality, course, payment_terms,
      // Assessment fields (computed on frontend, validated here)
      tuition_per_unit, total_units, tuition_fee,
      registration_fee, library_fee, lab_fee, id_fee, others_fee,
      installment_fee, total_assessment, amount_due,
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !email || !contact_number || !course) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: first_name, last_name, email, contact_number, course'
      });
    }

    const referenceId = generateReferenceId();

    // Check if receipt was uploaded (file comes via multer)
    const file = (req as any).file;
    const receiptPath = file ? file.path : null;
    const receiptName = file ? file.originalname : null;

    // Determine initial status
    const status = file ? 'Payment Submitted' : 'Pending Payment';

    // Log the submission
    await logActivity('Student', 'PRE_REGISTRATION_SUBMITTED', {
      reference_id: referenceId,
      name: `${first_name} ${last_name}`,
      email,
      course,
      admission_type,
      status,
      has_receipt: !!receiptPath
    });

    await run(
      `INSERT INTO pre_registrations (
        reference_id,
        first_name, middle_name, last_name, suffix,
        email, contact_number, birth_date, gender, address,
        admission_type, source_of_awareness,
        learning_modality, course, payment_terms,
        tuition_per_unit, total_units, tuition_fee,
        registration_fee, library_fee, lab_fee, id_fee, others_fee,
        installment_fee, total_assessment, amount_due,
        receipt_file_path, receipt_file_name,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        referenceId,
        first_name, middle_name || null, last_name, suffix || null,
        email, contact_number, birth_date || null, gender || null, address || null,
        admission_type || 'New', source_of_awareness || null,
        learning_modality || 'Face-to-Face', course, payment_terms || 'Full',
        tuition_per_unit || 0, total_units || 0, tuition_fee || 0,
        registration_fee || 0, library_fee || 0, lab_fee || 0, id_fee || 0, others_fee || 0,
        installment_fee || 0, total_assessment || 0, amount_due || 0,
        receiptPath, receiptName,
        status
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Pre-registration submitted successfully',
      data: { reference_id: referenceId, status }
    });
  } catch (error: any) {
    console.error('Submit pre-registration error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Track a pre-registration application by reference ID (public)
 */
export const trackPreRegistration = async (req: Request, res: Response) => {
  try {
    const { referenceId } = req.params;

    const record = await get(
      `SELECT reference_id, first_name, last_name, email, course, admission_type,
              learning_modality, payment_terms, total_assessment, amount_due,
              installment_fee, status,
              cashier_remarks, admin_remarks,
              created_at, verified_at, account_created_at
       FROM pre_registrations WHERE reference_id = ?`,
      [referenceId]
    );

    if (!record) {
      return res.status(404).json({ success: false, message: 'Application not found. Please check your Reference ID.' });
    }

    res.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Track pre-registration error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── CASHIER ENDPOINTS ───

/**
 * Get all pre-registrations pending cashier verification
 */
export const getCashierQueue = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    let sql = `SELECT * FROM pre_registrations WHERE 1=1`;
    const params: any[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    } else {
      sql += ' AND status IN (?, ?)';
      params.push('Payment Submitted', 'Payment Rejected');
    }

    sql += ' ORDER BY created_at DESC';
    const rows = await query(sql, params);

    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Get cashier queue error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Cashier verifies or rejects a payment
 */
export const verifyCashierPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, remarks } = req.body; // action: 'verify' or 'reject'
    const userId = req.user?.id;

    if (!['verify', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Use "verify" or "reject".' });
    }

    const record: any = await get('SELECT * FROM pre_registrations WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Pre-registration not found' });
    }

    if (action === 'verify') {
      await run(
        `UPDATE pre_registrations 
         SET status = 'In Admin Queue', cashier_remarks = ?, verified_by = ?, verified_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`,
        [remarks || null, userId, id]
      );
      
      // Log verification
      const verified = await get('SELECT * FROM pre_registrations WHERE id = ?', [id]);
      await logActivity(`Cashier-${userId}`, 'PAYMENT_VERIFIED', {
        pre_reg_id: id,
        reference_id: verified?.reference_id,
        applicant: `${verified?.first_name} ${verified?.last_name}`,
        remarks
      });
      
      res.json({ success: true, message: 'Payment verified. Application moved to admin queue.' });
    } else {
      await run(
        `UPDATE pre_registrations 
         SET status = 'Payment Rejected', cashier_remarks = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [remarks || 'Payment receipt invalid. Please re-upload or contact support.', id]
      );
      
      // Log rejection
      const rejected = await get('SELECT * FROM pre_registrations WHERE id = ?', [id]);
      await logActivity(`Cashier-${userId}`, 'PAYMENT_REJECTED', {
        pre_reg_id: id,
        reference_id: rejected?.reference_id,
        applicant: `${rejected?.first_name} ${rejected?.last_name}`,
        remarks: remarks || 'Payment receipt invalid'
      });
      
      res.json({ success: true, message: 'Payment rejected. Student will need to re-upload.' });
    }
  } catch (error: any) {
    console.error('Verify cashier payment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── ADMIN ENDPOINTS ───

/**
 * Get all verified pre-registrations in admin queue
 */
export const getAdminQueue = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    let sql = `SELECT * FROM pre_registrations WHERE 1=1`;
    const params: any[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    } else {
      sql += ' AND status IN (?, ?)';
      params.push('In Admin Queue', 'Account Created');
    }

    sql += ' ORDER BY created_at DESC';
    const rows = await query(sql, params);

    res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Get admin queue error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin creates a student account from a pre-registration (Phase 5)
 */
export const createAccountFromPreReg = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { username, password } = req.body;
    const adminId = req.user?.id;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'username and password are required' });
    }

    const record: any = await get('SELECT * FROM pre_registrations WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Pre-registration not found' });
    }
    if (record.status !== 'In Admin Queue') {
      return res.status(400).json({ success: false, message: `Cannot create account. Current status: ${record.status}` });
    }

    // Check username uniqueness
    const existingUser = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate student_id
    const year = new Date().getFullYear();
    const countResult: any = await get('SELECT COUNT(*) as cnt FROM students');
    const nextNum = (countResult?.cnt || 0) + 1;
    const studentId = `${year}-${String(nextNum).padStart(6, '0')}`;

    // Create user
    const userResult = await run(
      `INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, 'student')`,
      [username, hashedPassword, record.email]
    );
    const userId = userResult.lastInsertRowid;

    // Create student
    await run(
      `INSERT INTO students (
        user_id, student_id, first_name, middle_name, last_name, suffix,
        contact_number, birth_date, gender, address,
        student_type, course, year_level, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Active')`,
      [
        userId, studentId,
        record.first_name, record.middle_name, record.last_name, record.suffix,
        record.contact_number, record.birth_date, record.gender, record.address,
        record.admission_type, record.course
      ]
    );

    // Mark pre-registration as account created
    await run(
      `UPDATE pre_registrations 
       SET status = 'Account Created', created_by_admin = ?, account_created_at = datetime('now'), admin_remarks = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [adminId, `Account created. Username: ${username}, Student ID: ${studentId}`, id]
    );

    // Log account creation
    await logActivity(`Admin-${adminId}`, 'ACCOUNT_CREATED_FROM_PREREG', {
      pre_reg_id: id,
      reference_id: record.reference_id,
      student_id: studentId,
      student_name: `${record.first_name} ${record.last_name}`,
      username,
      course: record.course
    });

    res.json({
      success: true,
      message: 'Student account created successfully',
      data: { student_id: studentId, username, user_id: userId }
    });
  } catch (error: any) {
    console.error('Create account from pre-reg error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * Get pre-registration details by ID (admin/cashier)
 */
export const getPreRegById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const record = await get('SELECT * FROM pre_registrations WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Get pre-reg by id error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
