-- ============================================================
-- Supabase / PostgreSQL Schema for Enrollment System
-- Run this in Supabase SQL Editor to create all tables
-- ============================================================

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student', 'admin', 'superadmin', 'dean', 'registrar', 'cashier', 'faculty')),
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_role ON users(role);

-- 2. Faculty
CREATE TABLE IF NOT EXISTS faculty (
  id SERIAL PRIMARY KEY,
  faculty_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  suffix TEXT,
  department TEXT,
  specialization TEXT,
  email TEXT,
  contact_number TEXT,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'On Leave')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_faculty_id ON faculty(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty(department);

-- 3. Students
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  suffix TEXT,
  student_type TEXT NOT NULL CHECK(student_type IN ('New', 'Transferee', 'Returning', 'Continuing', 'Scholar', 'new', 'transferee', 'returning', 'continuing', 'scholar')),
  course TEXT,
  year_level INTEGER,
  section TEXT,
  student_classification TEXT DEFAULT 'Regular' CHECK(student_classification IN ('Regular', 'Irregular')),
  contact_number TEXT,
  address TEXT,
  birth_date TEXT,
  gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')),
  cor_status TEXT DEFAULT 'Updated',
  grades_complete INTEGER DEFAULT 0,
  clearance_status TEXT DEFAULT 'Clear',
  status TEXT DEFAULT 'Active' CHECK(status IN ('Pending', 'Active', 'Inactive', 'Graduated')),
  form137_status TEXT DEFAULT 'Pending',
  form138_status TEXT DEFAULT 'Pending',
  tor_status TEXT DEFAULT 'Pending',
  certificate_transfer_status TEXT DEFAULT 'Pending',
  birth_certificate_status TEXT DEFAULT 'Pending',
  moral_certificate_status TEXT DEFAULT 'Pending',
  school_name TEXT,
  last_school_attended TEXT,
  preferred_contact_method TEXT CHECK(preferred_contact_method IN ('Email', 'Number')),
  heard_about_informatics TEXT DEFAULT 'Other',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_student_type ON students(student_type);
CREATE INDEX IF NOT EXISTS idx_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_cor_status ON students(cor_status);

-- 4. Sections
CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  section_code TEXT UNIQUE NOT NULL,
  section_name TEXT NOT NULL,
  course TEXT NOT NULL,
  year_level INTEGER NOT NULL,
  school_year TEXT NOT NULL,
  semester TEXT CHECK(semester IN ('1st', '2nd', '3rd')),
  capacity INTEGER DEFAULT 50,
  current_enrollment INTEGER DEFAULT 0,
  adviser_id INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_section_code ON sections(section_code);
CREATE INDEX IF NOT EXISTS idx_section_course ON sections(course, year_level);

-- 5. Enrollments
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year TEXT NOT NULL,
  semester TEXT NOT NULL CHECK(semester IN ('1st', '2nd', '3rd')),
  status TEXT DEFAULT 'Pending Assessment' CHECK(status IN ('Pending Assessment', 'For Admin Approval', 'For Subject Selection', 'For Registrar Assessment', 'Cashier Review', 'For Dean Approval', 'For Payment', 'Ready for Payment', 'Payment Verification', 'Enrolled', 'Rejected')),
  enrollment_date TIMESTAMPTZ DEFAULT NOW(),
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  assessed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assessed_at TIMESTAMPTZ,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  total_units INTEGER DEFAULT 0,
  total_amount REAL DEFAULT 0.00,
  scholarship_type TEXT DEFAULT 'None',
  scholarship_letter_path TEXT,
  scholarship_coverage TEXT,
  tuition REAL DEFAULT 0.00,
  registration REAL DEFAULT 0.00,
  library REAL DEFAULT 0.00,
  lab REAL DEFAULT 0.00,
  id_fee REAL DEFAULT 0.00,
  others REAL DEFAULT 0.00,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_enrollment ON enrollments(student_id, school_year, semester);
CREATE INDEX IF NOT EXISTS idx_enrollment_status ON enrollments(status);

-- 6. Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  subject_code TEXT UNIQUE NOT NULL,
  subject_name TEXT NOT NULL,
  description TEXT,
  units INTEGER NOT NULL,
  course TEXT,
  year_level INTEGER,
  semester TEXT CHECK(semester IN ('1st', '2nd', '3rd')),
  subject_type TEXT DEFAULT 'College' CHECK(subject_type IN ('SHS', 'College')),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subject_code ON subjects(subject_code);
CREATE INDEX IF NOT EXISTS idx_course_year ON subjects(course, year_level);

-- 7. Enrollment Subjects
CREATE TABLE IF NOT EXISTS enrollment_subjects (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  schedule TEXT,
  room TEXT,
  instructor TEXT,
  status TEXT DEFAULT 'Enrolled' CHECK(status IN ('Enrolled', 'Dropped', 'Completed')),
  grade TEXT,
  grade_status TEXT,
  schedule_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(enrollment_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_subjects_enrollment ON enrollment_subjects(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_subjects_subject ON enrollment_subjects(subject_id);

-- 8. Enrollment Subject Audit
CREATE TABLE IF NOT EXISTS enrollment_subject_audit (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('ADD', 'DROP', 'REPLACE_ADD', 'REPLACE_DROP')),
  reason TEXT,
  performed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performed_by_name TEXT,
  old_total_units INTEGER,
  new_total_units INTEGER,
  old_total_amount REAL,
  new_total_amount REAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subject_audit_enrollment ON enrollment_subject_audit(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_subject_audit_performed_by ON enrollment_subject_audit(performed_by);

-- 9. Documents
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Verified', 'Rejected')),
  verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  remarks TEXT
);
CREATE INDEX IF NOT EXISTS idx_student_docs ON documents(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_docs ON documents(enrollment_id);

-- 10. Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('Enrollment Fee', 'Tuition', 'Miscellaneous', 'Refund', 'Other')),
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Check', 'GCash')),
  reference_number TEXT,
  receipt_path TEXT,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  processed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Completed', 'Cancelled', 'Refunded', 'Rejected')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enrollment_transactions ON transactions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_transaction_reference ON transactions(reference_number);
CREATE INDEX IF NOT EXISTS idx_transaction_status ON transactions(status);

-- 11. Installment Payments
CREATE TABLE IF NOT EXISTS installment_payments (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  amount_paid REAL DEFAULT 0.00,
  penalty_amount REAL DEFAULT 0.00,
  period TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Completed')),
  payment_method TEXT CHECK(payment_method IN ('Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Check', 'GCash')),
  payment_date TEXT,
  due_date TEXT,
  reference_number TEXT,
  receipt_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_installment_enrollment ON installment_payments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_installment_student ON installment_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_installment_status ON installment_payments(status);

-- 12. Promissory Notes
CREATE TABLE IF NOT EXISTS promissory_notes (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  amount_due REAL NOT NULL,
  promised_date TEXT NOT NULL,
  reason TEXT,
  file_path TEXT,
  file_name TEXT,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected')),
  remarks TEXT,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promissory_enrollment ON promissory_notes(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_promissory_student ON promissory_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_promissory_status ON promissory_notes(status);

-- 13. Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  description TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_activity ON activity_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_entity ON activity_logs(entity_type, entity_id);

-- 14. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_student ON notifications(student_id, is_read);

-- 15. School Years
CREATE TABLE IF NOT EXISTS school_years (
  id SERIAL PRIMARY KEY,
  school_year TEXT UNIQUE NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  enrollment_start TEXT,
  enrollment_end TEXT,
  is_active INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_school_year ON school_years(school_year);

-- 16. Semesters
CREATE TABLE IF NOT EXISTS semesters (
  id SERIAL PRIMARY KEY,
  school_year_id INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  semester_number INTEGER NOT NULL CHECK(semester_number IN (1, 2, 3)),
  semester_name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_year_id, semester_number)
);
CREATE INDEX IF NOT EXISTS idx_semester_school_year ON semesters(school_year_id);
CREATE INDEX IF NOT EXISTS idx_semester_active ON semesters(is_active);

-- 17. Programs
CREATE TABLE IF NOT EXISTS programs (
  id SERIAL PRIMARY KEY,
  program_code TEXT UNIQUE NOT NULL,
  program_name TEXT NOT NULL,
  description TEXT,
  department TEXT,
  degree_type TEXT CHECK(degree_type IN ('Bachelor', 'Associate', 'Master', 'Doctorate')),
  duration_years INTEGER,
  total_units INTEGER,
  status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_program_code ON programs(program_code);

-- 18. Curriculum
CREATE TABLE IF NOT EXISTS curriculum (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  year_level INTEGER NOT NULL,
  semester TEXT CHECK(semester IN ('1st', '2nd', '3rd')),
  is_core INTEGER DEFAULT 1,
  prerequisite_subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, subject_id, year_level, semester)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_program ON curriculum(program_id);

-- 19. Clearances
CREATE TABLE IF NOT EXISTS clearances (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  clearance_type TEXT NOT NULL,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Cleared', 'Blocked')),
  issue_description TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clearance_student ON clearances(student_id);
CREATE INDEX IF NOT EXISTS idx_clearance_status ON clearances(status);

-- 20. CORs (Certificate of Registration)
CREATE TABLE IF NOT EXISTS cors (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  cor_number TEXT UNIQUE,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Generated', 'Approved', 'Printed')),
  generated_at TIMESTAMPTZ,
  generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  printed_at TIMESTAMPTZ,
  printed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cor_student ON cors(student_id);
CREATE INDEX IF NOT EXISTS idx_cor_enrollment ON cors(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_cor_number ON cors(cor_number);

-- 21. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_setting_key ON system_settings(setting_key);

-- 22. Courses Fees
CREATE TABLE IF NOT EXISTS courses_fees (
  id SERIAL PRIMARY KEY,
  course TEXT UNIQUE NOT NULL,
  tuition_per_unit REAL DEFAULT 700.00,
  registration REAL DEFAULT 500.00,
  library REAL DEFAULT 500.00,
  lab REAL DEFAULT 2000.00,
  id_fee REAL DEFAULT 200.00,
  others REAL DEFAULT 300.00,
  installment_fee REAL DEFAULT 500.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_course_fees ON courses_fees(course);

-- 23. Subject Schedules
CREATE TABLE IF NOT EXISTS subject_schedules (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  day_time TEXT NOT NULL,
  room TEXT,
  instructor TEXT,
  capacity INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subject_schedules_subject ON subject_schedules(subject_id);

-- 24. Pre-Registration
CREATE TABLE IF NOT EXISTS pre_registrations (
  id SERIAL PRIMARY KEY,
  reference_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  suffix TEXT,
  email TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT,
  address TEXT,
  admission_type TEXT NOT NULL DEFAULT 'New',
  source_of_awareness TEXT,
  learning_modality TEXT NOT NULL DEFAULT 'Face-to-Face',
  course TEXT NOT NULL,
  payment_terms TEXT NOT NULL DEFAULT 'Full',
  tuition_per_unit REAL DEFAULT 0,
  total_units INTEGER DEFAULT 0,
  tuition_fee REAL DEFAULT 0,
  registration_fee REAL DEFAULT 0,
  library_fee REAL DEFAULT 0,
  lab_fee REAL DEFAULT 0,
  id_fee REAL DEFAULT 0,
  others_fee REAL DEFAULT 0,
  installment_fee REAL DEFAULT 0,
  total_assessment REAL DEFAULT 0,
  amount_due REAL DEFAULT 0,
  receipt_file_path TEXT,
  receipt_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'Pending Payment' CHECK(status IN (
    'Pending Payment', 'Payment Submitted', 'Payment Verified',
    'Payment Rejected', 'In Admin Queue', 'Account Created', 'Rejected'
  )),
  cashier_remarks TEXT,
  admin_remarks TEXT,
  verified_by INTEGER REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_by_admin INTEGER REFERENCES users(id),
  account_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prereg_reference ON pre_registrations(reference_id);
CREATE INDEX IF NOT EXISTS idx_prereg_status ON pre_registrations(status);
CREATE INDEX IF NOT EXISTS idx_prereg_email ON pre_registrations(email);

-- 25. Student Requirements
CREATE TABLE IF NOT EXISTS student_requirements (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  requirement_name TEXT NOT NULL,
  requirement_type TEXT NOT NULL CHECK(requirement_type IN ('Initial', 'INC')),
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Submitted', 'Received', 'Verified', 'Rejected', 'Incomplete')),
  file_path TEXT,
  file_name TEXT,
  hard_copy_submitted INTEGER DEFAULT 0,
  hard_copy_received_at TIMESTAMPTZ,
  remarks TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. OVR Requests
CREATE TABLE IF NOT EXISTS ovr_requests (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year TEXT,
  semester TEXT,
  requested_units INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Denied')),
  registrar_remarks TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 27. Grade Approvals (created dynamically by grades controller)
CREATE TABLE IF NOT EXISTS grade_approvals (
  id SERIAL PRIMARY KEY,
  enrollment_subject_id INTEGER NOT NULL,
  submitted_grade TEXT NOT NULL,
  submitted_by INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  approved_by INTEGER,
  approved_at TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 28. Scholarship Applications (created dynamically by scholarship controller)
CREATE TABLE IF NOT EXISTS scholarship_applications (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  scholarship_type TEXT NOT NULL,
  academic_year TEXT,
  semester TEXT,
  gpa REAL,
  documents TEXT,
  requirements TEXT,
  status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Under Review', 'Approved', 'Rejected', 'Revoked')),
  remarks TEXT,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  coverage_details TEXT,
  discount_percentage REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
