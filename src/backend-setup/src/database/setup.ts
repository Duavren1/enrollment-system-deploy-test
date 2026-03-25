import db, { run, query } from './connection';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('student', 'admin', 'superadmin', 'dean', 'registrar', 'cashier', 'faculty')),
        email TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('✅ Users table created');

    // Create index on username and role
    db.exec('CREATE INDEX IF NOT EXISTS idx_username ON users(username)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_role ON users(role)');

    // Create students table
    db.exec(`
      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        student_id TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        middle_name TEXT,
        last_name TEXT NOT NULL,
        suffix TEXT,
        student_type TEXT NOT NULL CHECK(student_type IN ('New', 'Transferee', 'Returning', 'Continuing', 'Scholar', 'new', 'transferee', 'returning', 'continuing', 'scholar')),
        course TEXT,
        year_level INTEGER,
        contact_number TEXT,
        address TEXT,
        birth_date TEXT,
        gender TEXT CHECK(gender IN ('Male', 'Female', 'Other')),
        cor_status TEXT DEFAULT 'Updated',
        grades_complete INTEGER DEFAULT 0,
        clearance_status TEXT DEFAULT 'Clear',
        status TEXT DEFAULT 'Active' CHECK(status IN ('Pending', 'Active', 'Inactive', 'Graduated')),
        -- Requirement status fields for New students
        form137_status TEXT DEFAULT 'Pending',
        form138_status TEXT DEFAULT 'Pending',
        -- Requirement status fields for Transferee students
        tor_status TEXT DEFAULT 'Pending',
        certificate_transfer_status TEXT DEFAULT 'Pending',
        -- Common requirement status fields
        birth_certificate_status TEXT DEFAULT 'Pending',
        moral_certificate_status TEXT DEFAULT 'Pending',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Students table created');

    // Add section column if it doesn't exist
    try {
      db.exec(`ALTER TABLE students ADD COLUMN section TEXT`);
      console.log('✅ Section column added to students table');
    } catch (e: any) {
      // Column already exists, ignore
      if (!e.message?.includes('duplicate column')) {
        console.log('Section column already exists');
      }
    }

    // Add student_classification column if it doesn't exist
    try {
      db.exec(`ALTER TABLE students ADD COLUMN student_classification TEXT DEFAULT 'Regular' CHECK(student_classification IN ('Regular', 'Irregular'))`);
      console.log('✅ Student classification column added to students table');
    } catch (e: any) {
      // Column already exists, ignore
      if (!e.message?.includes('duplicate column')) {
        console.log('Student classification column already exists');
      }
    }

    // Add school_name column if it doesn't exist
    try {
      db.exec(`ALTER TABLE students ADD COLUMN school_name TEXT`);
      console.log('✅ school_name column added to students table');
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        console.log('school_name column already exists');
      }
    }

    // Add last_school_attended column if it doesn't exist
    try {
      db.exec(`ALTER TABLE students ADD COLUMN last_school_attended TEXT`);
      console.log('✅ last_school_attended column added to students table');
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        console.log('last_school_attended column already exists');
      }
    }

    // Add preferred_contact_method column if it doesn't exist
    try {
      db.exec(`ALTER TABLE students ADD COLUMN preferred_contact_method TEXT CHECK(preferred_contact_method IN ('Email', 'Number'))`);
      console.log('✅ preferred_contact_method column added to students table');
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        console.log('preferred_contact_method column already exists');
      }
    }

    // Add heard_about_informatics column
    try {
      db.exec(`
        ALTER TABLE students 
        ADD COLUMN heard_about_informatics TEXT DEFAULT 'Other'
      `);
      console.log('✅ heard_about_informatics column added to students table');
    } catch (e: any) {
      if (!e.message?.includes('duplicate column')) {
        console.log('heard_about_informatics column already exists');
      }
    }

    // Create indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_student_id ON students(student_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_student_type ON students(student_type)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_status ON students(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_cor_status ON students(cor_status)');

    // Create enrollments table (includes assessment fee columns)
    db.exec(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        school_year TEXT NOT NULL,
        semester TEXT NOT NULL CHECK(semester IN ('1st', '2nd', '3rd')),
        status TEXT DEFAULT 'Pending Assessment' CHECK(status IN ('Pending Assessment', 'For Admin Approval', 'For Subject Selection', 'For Registrar Assessment', 'Cashier Review', 'For Dean Approval', 'For Payment', 'Ready for Payment', 'Payment Verification', 'Enrolled', 'Rejected')),
        enrollment_date TEXT DEFAULT (datetime('now')),
        section_id INTEGER,
        assessed_by INTEGER,
        assessed_at TEXT,
        approved_by INTEGER,
        approved_at TEXT,
        rejected_by INTEGER,
        rejected_at TEXT,
        total_units INTEGER DEFAULT 0,
        total_amount REAL DEFAULT 0.00,
        scholarship_type TEXT DEFAULT 'None',
        scholarship_letter_path TEXT,
        scholarship_coverage TEXT,
        -- Assessment breakdown fields
        tuition REAL DEFAULT 0.00,
        registration REAL DEFAULT 0.00,
        library REAL DEFAULT 0.00,
        lab REAL DEFAULT 0.00,
        id_fee REAL DEFAULT 0.00,
        others REAL DEFAULT 0.00,
        remarks TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
        FOREIGN KEY (assessed_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Enrollments table created');

    // Create indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_student_enrollment ON enrollments(student_id, school_year, semester)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_enrollment_status ON enrollments(status)');

    // Backfill / add missing assessment columns for existing databases
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN scholarship_type TEXT DEFAULT 'None'");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN scholarship_letter_path TEXT");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN scholarship_coverage TEXT");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN tuition REAL DEFAULT 0.00");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN registration REAL DEFAULT 0.00");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN library REAL DEFAULT 0.00");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN lab REAL DEFAULT 0.00");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN id_fee REAL DEFAULT 0.00");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN others REAL DEFAULT 0.00");
    } catch (e) {}
    // Backfill section_id column if missing
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL");
    } catch (e) {}
    // Add rejection tracking columns for registrar rejection
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
    } catch (e) {}
    try {
      db.exec("ALTER TABLE enrollments ADD COLUMN rejected_at TEXT");
    } catch (e) {}

    // Migration: Update CHECK constraint to include 'Cashier Review' status for existing databases
    try {
      const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='enrollments'").get() as any;
      if (tableInfo?.sql && !tableInfo.sql.includes('Cashier Review')) {
        console.log('🔄 Migrating enrollments table to add Cashier Review status...');
        db.exec('PRAGMA foreign_keys=OFF');
        db.exec(`
          CREATE TABLE enrollments_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            school_year TEXT NOT NULL,
            semester TEXT NOT NULL CHECK(semester IN ('1st', '2nd', '3rd')),
            status TEXT DEFAULT 'Pending Assessment' CHECK(status IN ('Pending Assessment', 'For Admin Approval', 'For Subject Selection', 'For Registrar Assessment', 'Cashier Review', 'For Dean Approval', 'For Payment', 'Ready for Payment', 'Payment Verification', 'Enrolled', 'Rejected')),
            enrollment_date TEXT DEFAULT (datetime('now')),
            section_id INTEGER,
            assessed_by INTEGER,
            assessed_at TEXT,
            approved_by INTEGER,
            approved_at TEXT,
            rejected_by INTEGER,
            rejected_at TEXT,
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
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
            FOREIGN KEY (assessed_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL
          )
        `);
        // Copy data - get existing column names to handle missing columns
        const cols = (db.prepare("PRAGMA table_info(enrollments)").all() as any[]).map((c: any) => c.name);
        const newCols = ['id','student_id','school_year','semester','status','enrollment_date','section_id','assessed_by','assessed_at','approved_by','approved_at','rejected_by','rejected_at','total_units','total_amount','scholarship_type','scholarship_letter_path','scholarship_coverage','tuition','registration','library','lab','id_fee','others','remarks','created_at','updated_at'];
        const commonCols = newCols.filter(c => cols.includes(c));
        const colList = commonCols.join(', ');
        db.exec(`INSERT INTO enrollments_new (${colList}) SELECT ${colList} FROM enrollments`);
        db.exec('DROP TABLE enrollments');
        db.exec('ALTER TABLE enrollments_new RENAME TO enrollments');
        db.exec('CREATE INDEX IF NOT EXISTS idx_student_enrollment ON enrollments(student_id, school_year, semester)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_enrollment_status ON enrollments(status)');
        db.exec('PRAGMA foreign_keys=ON');
        console.log('✅ Enrollments table migrated with Cashier Review status');
      }
    } catch (migrationErr) {
      console.warn('⚠️ Enrollment table migration skipped or failed:', migrationErr);
    }

    // Create subjects table
    db.exec(`
      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_code TEXT UNIQUE NOT NULL,
        subject_name TEXT NOT NULL,
        description TEXT,
        units INTEGER NOT NULL,
        course TEXT,
        year_level INTEGER,
        semester TEXT CHECK(semester IN ('1st', '2nd', '3rd')),
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('✅ Subjects table created');

    // Create indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_subject_code ON subjects(subject_code)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_course_year ON subjects(course, year_level)');

    // Create enrollment_subjects table
    db.exec(`
      CREATE TABLE IF NOT EXISTS enrollment_subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        schedule TEXT,
        room TEXT,
        instructor TEXT,
        status TEXT DEFAULT 'Enrolled' CHECK(status IN ('Enrolled', 'Dropped', 'Completed')),
        grade TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        UNIQUE(enrollment_id, subject_id)
      )
    `);
    console.log('✅ Enrollment subjects table created');

    // Create indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_enrollment_subjects_enrollment ON enrollment_subjects(enrollment_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_enrollment_subjects_subject ON enrollment_subjects(subject_id)');

    // Create enrollment_subject_audit table (tracks all add/drop/replace changes by registrar)
    db.exec(`
      CREATE TABLE IF NOT EXISTS enrollment_subject_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('ADD', 'DROP', 'REPLACE_ADD', 'REPLACE_DROP')),
        reason TEXT,
        performed_by INTEGER NOT NULL,
        performed_by_name TEXT,
        old_total_units INTEGER,
        new_total_units INTEGER,
        old_total_amount REAL,
        new_total_amount REAL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Enrollment subject audit table created');

    db.exec('CREATE INDEX IF NOT EXISTS idx_subject_audit_enrollment ON enrollment_subject_audit(enrollment_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_subject_audit_performed_by ON enrollment_subject_audit(performed_by)');

    // Create documents table
    db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        enrollment_id INTEGER,
        document_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        upload_date TEXT DEFAULT (datetime('now')),
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Verified', 'Rejected')),
        verified_by INTEGER,
        verified_at TEXT,
        remarks TEXT,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Documents table created');

    // Create indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_student_docs ON documents(student_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_enrollment_docs ON documents(enrollment_id)');

    // Create transactions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('Enrollment Fee', 'Tuition', 'Miscellaneous', 'Refund', 'Other')),
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Check', 'GCash')),
        reference_number TEXT,
        receipt_path TEXT,
        payment_date TEXT DEFAULT (datetime('now')),
        processed_by INTEGER,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Completed', 'Cancelled', 'Refunded', 'Rejected')),
        remarks TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Transactions table created');

    // Create indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_enrollment_transactions ON transactions(enrollment_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_transaction_reference ON transactions(reference_number)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_transaction_status ON transactions(status)');

    // Create installment_payments table for partial payment tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS installment_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enrollment_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        period TEXT NOT NULL,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Completed')),
        payment_method TEXT CHECK(payment_method IN ('Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Check', 'GCash')),
        payment_date TEXT,
        reference_number TEXT,
        receipt_path TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Installment payments table created');

    // Create indexes for installment_payments
    db.exec('CREATE INDEX IF NOT EXISTS idx_installment_enrollment ON installment_payments(enrollment_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_installment_student ON installment_payments(student_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_installment_status ON installment_payments(status)');

    // Migration: Add amount_paid column to installment_payments if it doesn't exist
    try {
      db.exec("ALTER TABLE installment_payments ADD COLUMN amount_paid REAL DEFAULT 0.00");
      console.log('✅ Added amount_paid column to installment_payments');
    } catch (e: any) {
      // Column already exists
      console.log('ℹ️  amount_paid column already exists or other migration issue:', e.message);
    }

    // Verify the column exists by checking pragma
    try {
      const columns = db.prepare("PRAGMA table_info(installment_payments)").all();
      const hasAmountPaid = (columns as any[]).some(col => col.name === 'amount_paid');
      if (!hasAmountPaid) {
        console.warn('⚠️  amount_paid column not found, attempting to add it...');
        db.exec("ALTER TABLE installment_payments ADD COLUMN amount_paid REAL DEFAULT 0.00");
        console.log('✅ Successfully added amount_paid column');
      }
    } catch (e: any) {
      console.error('Failed to verify/add amount_paid column:', e);
    }

    // Migration: Add penalty_amount column to installment_payments if it doesn't exist
    try {
      db.exec("ALTER TABLE installment_payments ADD COLUMN penalty_amount REAL DEFAULT 0.00");
      console.log('✅ Added penalty_amount column to installment_payments');
    } catch (e: any) {
      // Column already exists
    }

    // Migration: Add due_date column to installment_payments if it doesn't exist
    try {
      db.exec("ALTER TABLE installment_payments ADD COLUMN due_date TEXT");
      console.log('✅ Added due_date column to installment_payments');
    } catch (e: any) {
      // Column already exists
    }

    // Migration: Fix enrollments stuck at 'For Payment' that have an approved down payment
    try {
      const fixed = db.prepare(`
        UPDATE enrollments SET status = 'Enrolled', updated_at = datetime('now')
        WHERE status IN ('For Payment', 'Payment Verification')
        AND id IN (
          SELECT DISTINCT enrollment_id FROM installment_payments 
          WHERE period = 'Down Payment' AND status = 'Approved'
        )
      `).run();
      if (fixed.changes > 0) {
        console.log(`✅ Fixed ${fixed.changes} enrollment(s) stuck at For Payment -> Enrolled`);
      }
    } catch (e: any) {
      // Ignore if tables don't exist yet
    }

    // Create activity_logs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        description TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Activity logs table created');

    // Create indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_activity ON activity_logs(user_id, created_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_entity ON activity_logs(entity_type, entity_id)');

    // Create notifications table for enrollment status updates
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_student ON notifications(student_id, is_read)');

    // Migration: Recreate notifications table if it has old schema (user_id + activity_log_id)
    try {
      const cols = db.pragma('table_info(notifications)') as any[];
      const hasStudentId = cols.some((c: any) => c.name === 'student_id');
      const hasTitle = cols.some((c: any) => c.name === 'title');
      if (!hasStudentId || !hasTitle) {
        console.log('Migrating notifications table to new schema...');
        db.exec('DROP TABLE IF EXISTS notifications');
        db.exec(`
          CREATE TABLE notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
          )
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_notifications_student ON notifications(student_id, is_read)');
        console.log('✅ Notifications table migrated successfully');
      }
    } catch (e) {
      console.error('Notifications migration check error:', e);
    }

    // Create faculty table (not users, just records)
    db.exec(`
      CREATE TABLE IF NOT EXISTS faculty (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('✅ Faculty table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_faculty_id ON faculty(faculty_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty(department)');

    // Create sections table
    db.exec(`
      CREATE TABLE IF NOT EXISTS sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_code TEXT UNIQUE NOT NULL,
        section_name TEXT NOT NULL,
        course TEXT NOT NULL,
        year_level INTEGER NOT NULL,
        school_year TEXT NOT NULL,
        semester TEXT CHECK(semester IN ('1st', '2nd', '3rd')),
        capacity INTEGER DEFAULT 50,
        current_enrollment INTEGER DEFAULT 0,
        adviser_id INTEGER,
        status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Closed')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (adviser_id) REFERENCES faculty(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Sections table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_section_code ON sections(section_code)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_section_course ON sections(course, year_level)');

    // Create school_years table
    db.exec(`
      CREATE TABLE IF NOT EXISTS school_years (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_year TEXT UNIQUE NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        enrollment_start TEXT,
        enrollment_end TEXT,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('✅ School years table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_school_year ON school_years(school_year)');

    // Create semesters table
    db.exec(`
      CREATE TABLE IF NOT EXISTS semesters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_year_id INTEGER NOT NULL,
        semester_number INTEGER NOT NULL CHECK(semester_number IN (1, 2, 3)),
        semester_name TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE,
        UNIQUE(school_year_id, semester_number)
      )
    `);
    console.log('✅ Semesters table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_semester_school_year ON semesters(school_year_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_semester_active ON semesters(is_active)');

    // Create programs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_code TEXT UNIQUE NOT NULL,
        program_name TEXT NOT NULL,
        description TEXT,
        department TEXT,
        degree_type TEXT CHECK(degree_type IN ('Bachelor', 'Associate', 'Master', 'Doctorate')),
        duration_years INTEGER,
        total_units INTEGER,
        status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Archived')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('✅ Programs table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_program_code ON programs(program_code)');

    // Create curriculum table
    db.exec(`
      CREATE TABLE IF NOT EXISTS curriculum (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        year_level INTEGER NOT NULL,
        semester TEXT CHECK(semester IN ('1st', '2nd', '3rd')),
        is_core INTEGER DEFAULT 1,
        prerequisite_subject_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (prerequisite_subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
        UNIQUE(program_id, subject_id, year_level, semester)
      )
    `);
    console.log('✅ Curriculum table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_curriculum_program ON curriculum(program_id)');

    // Create clearances table
    db.exec(`
      CREATE TABLE IF NOT EXISTS clearances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        clearance_type TEXT NOT NULL,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Cleared', 'Blocked')),
        issue_description TEXT,
        resolved_at TEXT,
        resolved_by INTEGER,
        remarks TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Clearances table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_clearance_student ON clearances(student_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_clearance_status ON clearances(status)');

    // Create cors table (Certificate of Registration)
    db.exec(`
      CREATE TABLE IF NOT EXISTS cors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        enrollment_id INTEGER NOT NULL,
        cor_number TEXT UNIQUE,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Generated', 'Approved', 'Printed')),
        generated_at TEXT,
        generated_by INTEGER,
        printed_at TEXT,
        printed_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
        FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (printed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ CORs table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_cor_student ON cors(student_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_cor_enrollment ON cors(enrollment_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_cor_number ON cors(cor_number)');

    // Create system_settings table to store predefined fees and other settings
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('✅ System settings table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_setting_key ON system_settings(setting_key)');

    // Insert default fee settings if they don't exist
    const insertSetting = db.prepare('INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)');
    const defaultSettings = [
      ['tuition_fee', '15000.00', 'Default tuition fee per semester'],
      ['registration_fee', '2500.00', 'Default registration fee'],
      ['library_fee', '1000.00', 'Default library fee'],
      ['lab_fee', '1500.00', 'Default laboratory fee'],
      ['id_fee', '500.00', 'Default ID fee'],
      ['others_fee', '1000.00', 'Default miscellaneous/other fees'],
      ['installment_penalty_fee', '500.00', 'Penalty fee applied automatically to overdue installment payments']
    ];
    
    const insertManySettings = db.transaction((settings: any[]) => {
      for (const setting of settings) {
        insertSetting.run(setting);
      }
    });
    
    insertManySettings(defaultSettings);
    console.log('✅ Default system fees configured');

    // Create courses_fees table to store per-unit tuition rate and fixed fees per course
    db.exec(`
      CREATE TABLE IF NOT EXISTS courses_fees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course TEXT UNIQUE NOT NULL,
        tuition_per_unit REAL DEFAULT 700.00,
        registration REAL DEFAULT 1500.00,
        library REAL DEFAULT 500.00,
        lab REAL DEFAULT 2000.00,
        id_fee REAL DEFAULT 200.00,
        others REAL DEFAULT 300.00,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('✅ Courses fees table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_course_fees ON courses_fees(course)');

    // Create subject_schedules table to store schedule options per subject
    db.exec(`
      CREATE TABLE IF NOT EXISTS subject_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        day_time TEXT NOT NULL,
        room TEXT,
        instructor TEXT,
        capacity INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Subject schedules table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_subject_schedules_subject ON subject_schedules(subject_id)');

    // Add schedule_id column to enrollment_subjects for referencing selected schedule (if not exists)
    try {
      const info = db.prepare("PRAGMA table_info(enrollment_subjects)").all();
      const hasScheduleId = info.some((c: any) => c.name === 'schedule_id');
      if (!hasScheduleId) {
        db.exec("ALTER TABLE enrollment_subjects ADD COLUMN schedule_id INTEGER REFERENCES subject_schedules(id)");
        console.log('✅ Added schedule_id column to enrollment_subjects');
      }
    } catch (e) {}

    // Add grade_status column to enrollment_subjects for tracking grade submission/approval
    try {
      const info2 = db.prepare("PRAGMA table_info(enrollment_subjects)").all();
      const hasGradeStatus = info2.some((c: any) => c.name === 'grade_status');
      if (!hasGradeStatus) {
        db.exec("ALTER TABLE enrollment_subjects ADD COLUMN grade_status TEXT DEFAULT NULL");
        console.log('✅ Added grade_status column to enrollment_subjects');
      }
    } catch (e) {}

    // Update subjects table to add subject_type (SHS or College)
    try {
      // Check if column exists
      const tableInfo = db.prepare("PRAGMA table_info(subjects)").all();
      const hasSubjectType = tableInfo.some((col: any) => col.name === 'subject_type');
      
      if (!hasSubjectType) {
        db.exec(`
          ALTER TABLE subjects ADD COLUMN subject_type TEXT DEFAULT 'College' CHECK(subject_type IN ('SHS', 'College'))
        `);
        console.log('✅ Added subject_type column to subjects table');
      }
    } catch (error) {
      // Column might already exist, ignore error
      console.log('⚠️ subject_type column may already exist');
    }

    // ── Pre-Registration Workflow Table ──
    db.exec(`
      CREATE TABLE IF NOT EXISTS pre_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference_id TEXT UNIQUE NOT NULL,

        -- Phase 1: Initial Information
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

        -- Phase 1: Learning Options
        learning_modality TEXT NOT NULL DEFAULT 'Face-to-Face',
        course TEXT NOT NULL,
        payment_terms TEXT NOT NULL DEFAULT 'Full',

        -- Phase 1: Assessment
        tuition_per_unit REAL DEFAULT 0,
        total_units INTEGER DEFAULT 0,
        tuition_fee REAL DEFAULT 0,
        registration_fee REAL DEFAULT 0,
        library_fee REAL DEFAULT 0,
        lab_fee REAL DEFAULT 0,
        id_fee REAL DEFAULT 0,
        others_fee REAL DEFAULT 0,
        total_assessment REAL DEFAULT 0,

        -- Phase 2: Payment
        receipt_file_path TEXT,
        receipt_file_name TEXT,

        -- Workflow status
        status TEXT NOT NULL DEFAULT 'Pending Payment'
          CHECK(status IN (
            'Pending Payment',
            'Payment Submitted',
            'Payment Verified',
            'Payment Rejected',
            'In Admin Queue',
            'Account Created',
            'Rejected'
          )),
        cashier_remarks TEXT,
        admin_remarks TEXT,
        verified_by INTEGER,
        verified_at TEXT,
        created_by_admin INTEGER,
        account_created_at TEXT,

        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (verified_by) REFERENCES users(id),
        FOREIGN KEY (created_by_admin) REFERENCES users(id)
      )
    `);
    console.log('✅ pre_registrations table created');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prereg_reference ON pre_registrations(reference_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prereg_status ON pre_registrations(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prereg_email ON pre_registrations(email)');

    // ── Requirements Workflow Tables ──

    // student_requirements: tracks individual requirement submissions per student
    db.exec(`
      CREATE TABLE IF NOT EXISTS student_requirements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        requirement_name TEXT NOT NULL,
        requirement_type TEXT NOT NULL CHECK(requirement_type IN ('Initial', 'INC')),
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Submitted', 'Verified', 'Rejected', 'Incomplete')),
        file_path TEXT,
        file_name TEXT,
        hard_copy_submitted INTEGER DEFAULT 0,
        hard_copy_received_at TEXT,
        remarks TEXT,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      )
    `);
    console.log('✅ student_requirements table created');

    // ovr_requests: tracks overload / OVR requests
    db.exec(`
      CREATE TABLE IF NOT EXISTS ovr_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        school_year TEXT,
        semester TEXT,
        requested_units INTEGER,
        reason TEXT,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Denied')),
        registrar_remarks TEXT,
        reviewed_by INTEGER,
        reviewed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      )
    `);
    console.log('✅ ovr_requests table created');

    // Insert default admin users (password: admin123)
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const defaultUsers = [
      ['superadmin', hashedPassword, 'superadmin', 'superadmin@informatics.edu'],
      ['admin1', hashedPassword, 'admin', 'admin@informatics.edu'],
      ['dean1', hashedPassword, 'dean', 'dean@informatics.edu'],
      ['registrar1', hashedPassword, 'registrar', 'registrar@informatics.edu'],
      ['cashier1', hashedPassword, 'cashier', 'cashier@informatics.edu']
    ];

    const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password, role, email) VALUES (?, ?, ?, ?)');
    const insertManyUsers = db.transaction((users: any[]) => {
      for (const user of users) {
        insertUser.run(user);
      }
    });
    
    insertManyUsers(defaultUsers);
    console.log('✅ Default users created');

    // Insert BSIT curriculum subjects
    const sampleSubjects = [
      // Year 1, Trimester 1 (1st)
      ['GE111', 'Understanding the Self', 3, 'BSIT', 1, '1st'],
      ['GE112', 'Readings in Philippine History', 3, 'BSIT', 1, '1st'],
      ['GE113', 'Ethics', 3, 'BSIT', 1, '1st'],
      ['NSTP1', 'NSTP 1', 3, 'BSIT', 1, '1st'],
      ['PE1', 'Physical Fitness', 2, 'BSIT', 1, '1st'],
      ['ITE111', 'Introduction to Computing', 3, 'BSIT', 1, '1st'],
      ['ITP111', 'Discrete Mathematics', 3, 'BSIT', 1, '1st'],
      // Year 1, Trimester 2 (2nd)
      ['GE124', 'The Contemporary World', 3, 'BSIT', 1, '2nd'],
      ['NSTP2', 'NSTP 2', 3, 'BSIT', 1, '2nd'],
      ['PE2', 'Rhythmic Activities', 2, 'BSIT', 1, '2nd'],
      ['ITE122', 'Computer Programming 1 - PLF/C', 4, 'BSIT', 1, '2nd'],
      ['ITP122', 'Multimedia Technology', 4, 'BSIT', 1, '2nd'],
      ['ITP123', 'Networking 1', 3, 'BSIT', 1, '2nd'],
      // Year 1, Trimester 3 (3rd)
      ['GE135', 'Purposive Communication', 3, 'BSIT', 1, '3rd'],
      ['PE3', 'Individual & Dual Sports', 2, 'BSIT', 1, '3rd'],
      ['ITR131', 'Application Project 1 - Innovation', 3, 'BSIT', 1, '3rd'],
      ['ITE133', 'Computer Programming 2 - Java', 4, 'BSIT', 1, '3rd'],
      ['ITP134', 'Networking 2', 3, 'BSIT', 1, '3rd'],
      ['ITE131', 'Cloud Computing', 3, 'BSIT', 1, '3rd'],
      // Year 2, Trimester 1 (1st)
      ['GE211', 'Mathematics in the Modern World', 3, 'BSIT', 2, '1st'],
      ['GE212', 'Komunikasyon sa Akademikong Filipino', 3, 'BSIT', 2, '1st'],
      ['PE4', 'Team Sports', 2, 'BSIT', 2, '1st'],
      ['ITP211', 'Fundamentals of DBMS', 4, 'BSIT', 2, '1st'],
      ['ITE211', 'Data Structures and Algorithms', 4, 'BSIT', 2, '1st'],
      ['ITE212', 'Application Development and Emerging', 3, 'BSIT', 2, '1st'],
      // Year 2, Trimester 2 (2nd)
      ['GE224', 'Science, Technology and Society', 3, 'BSIT', 2, '2nd'],
      ['GE225', 'Panitikan', 3, 'BSIT', 2, '2nd'],
      ['ITP222', 'Quantitative Methods', 3, 'BSIT', 2, '2nd'],
      ['ITE223', 'Integrative Programming and Technologies 1', 3, 'BSIT', 2, '2nd'],
      ['ITP224', 'System Administration and Maintenance', 3, 'BSIT', 2, '2nd'],
      ['ITE225', 'Information Management', 3, 'BSIT', 2, '2nd'],
      // Year 2, Trimester 3 (3rd)
      ['GE236', 'World Literature', 3, 'BSIT', 2, '3rd'],
      ['ITR231', 'Application Project 2', 3, 'BSIT', 2, '3rd'],
      ['ITP235', 'Information Assurance and Security 1', 3, 'BSIT', 2, '3rd'],
      ['ITP236', 'Systems Analysis and Design', 3, 'BSIT', 2, '3rd'],
      ['ITFE1', 'IT Elective 1', 3, 'BSIT', 2, '3rd'],
      // Year 3, Trimester 1 (1st)
      ['ITP313', 'Software Engineering', 3, 'BSIT', 3, '1st'],
      ['ITP311', 'Information Assurance and Security 2', 3, 'BSIT', 3, '1st'],
      ['ITP312', 'Social and Professional Issues', 3, 'BSIT', 3, '1st'],
      ['CAP1A', 'Capstone Project 1', 3, 'BSIT', 3, '1st'],
      ['ITP135', 'Human Computer Interaction', 3, 'BSIT', 3, '1st'],
      ['ITFE2', 'IT Elective 2', 3, 'BSIT', 3, '1st'],
      // Year 3, Trimester 2 (2nd)
      ['GE321', 'Art Appreciation', 3, 'BSIT', 3, '2nd'],
      ['ITP323', 'System Integration and Architecture 1', 3, 'BSIT', 3, '2nd'],
      ['CAP3B', 'Capstone Project 2', 3, 'BSIT', 3, '2nd'],
      ['ITFE3', 'IT Elective 3', 4, 'BSIT', 3, '2nd'],
      // Year 3, Trimester 3 (3rd)
      ['GE223', 'Rizal\'s Life and Works', 3, 'BSIT', 3, '3rd'],
      ['ITFE4', 'IT Elective 4', 3, 'BSIT', 3, '3rd'],
      ['OJT331A', 'Practicum (OJT 1)', 1, 'BSIT', 3, '3rd'],
      // Year 4, Trimester 1 (1st)
      ['OJT331B', 'Practicum (400hrs)', 5, 'BSIT', 4, '1st']
    ];

    const insertSubject = db.prepare('INSERT OR IGNORE INTO subjects (subject_code, subject_name, units, course, year_level, semester) VALUES (?, ?, ?, ?, ?, ?)');
    const insertManySubjects = db.transaction((subjects: any[]) => {
      for (const subject of subjects) {
        insertSubject.run(subject);
      }
    });
    
    insertManySubjects(sampleSubjects);
    console.log('✅ BSIT subjects created');

    // Insert BSCS curriculum subjects (unique to BSCS — shared GE/PE subjects use BSIT rows via curriculum table)
    const bscsSubjects = [
      // Year 1, Trimester 1 (1st)
      ['CSP111', 'Introduction to Computer Science', 3, 'BSCS', 1, '1st'],
      ['CSP112', 'Fundamentals of Programming (Python)', 4, 'BSCS', 1, '1st'],
      // Year 1, Trimester 2 (2nd)
      ['CSP121', 'Object-Oriented Programming', 4, 'BSCS', 1, '2nd'],
      ['CSP122', 'Computer Organization & Architecture', 3, 'BSCS', 1, '2nd'],
      // Year 1, Trimester 3 (3rd)
      ['CSP131', 'Data Structures & Algorithms', 4, 'BSCS', 1, '3rd'],
      ['CSP132', 'Digital Logic Design', 3, 'BSCS', 1, '3rd'],
      // Year 2, Trimester 1 (1st)
      ['CSP211', 'Algorithm Analysis & Design', 3, 'BSCS', 2, '1st'],
      ['ITE211B', 'Database Management Systems', 4, 'BSCS', 2, '1st'],
      ['ITE212B', 'Web Development Frameworks', 3, 'BSCS', 2, '1st'],
      // Year 2, Trimester 2 (2nd)
      ['CSP221', 'Operating Systems', 3, 'BSCS', 2, '2nd'],
      ['CSP222', 'Theory of Computation', 3, 'BSCS', 2, '2nd'],
      ['CSP223', 'Software Engineering', 3, 'BSCS', 2, '2nd'],
      ['CSP224', 'Numerical Methods', 3, 'BSCS', 2, '2nd'],
      // Year 2, Trimester 3 (3rd)
      ['CSP231', 'Computer Networks', 3, 'BSCS', 2, '3rd'],
      ['CSP232', 'Artificial Intelligence', 3, 'BSCS', 2, '3rd'],
      ['CSR231', 'Application Project (CS)', 3, 'BSCS', 2, '3rd'],
      // Year 3, Trimester 1 (1st)
      ['CSP311', 'Machine Learning', 3, 'BSCS', 3, '1st'],
      ['CSP312', 'Compiler Design', 3, 'BSCS', 3, '1st'],
      ['CSP313', 'Information Security', 3, 'BSCS', 3, '1st'],
      ['CSC1A', 'CS Capstone Project 1', 3, 'BSCS', 3, '1st'],
      ['CSFE1', 'CS Elective 1', 3, 'BSCS', 3, '1st'],
      // Year 3, Trimester 2 (2nd)
      ['CSP321', 'Parallel & Distributed Computing', 3, 'BSCS', 3, '2nd'],
      ['CSC1B', 'CS Capstone Project 2', 3, 'BSCS', 3, '2nd'],
      ['CSFE2', 'CS Elective 2', 3, 'BSCS', 3, '2nd'],
      ['GE331', 'Rizal\'s Life and Works', 3, 'BSCS', 3, '2nd'],
      // Year 3, Trimester 3 (3rd)
      ['CSFE3', 'CS Elective 3', 3, 'BSCS', 3, '3rd'],
      ['CSOJT', 'CS Practicum (OJT)', 6, 'BSCS', 3, '3rd'],
      // Year 4, Trimester 1 (1st)
      ['CSOJT2', 'CS Practicum 2 (400hrs)', 5, 'BSCS', 4, '1st'],
      ['CSP411', 'Thesis / Research Project', 3, 'BSCS', 4, '1st']
    ];

    const insertBscsSubject = db.prepare('INSERT OR IGNORE INTO subjects (subject_code, subject_name, units, course, year_level, semester) VALUES (?, ?, ?, ?, ?, ?)');
    const insertManyBscsSubjects = db.transaction((subjects: any[]) => {
      for (const subject of subjects) {
        insertBscsSubject.run(subject);
      }
    });
    insertManyBscsSubjects(bscsSubjects);
    console.log('✅ BSCS subjects created');

    // Seed programs
    db.prepare(`
      INSERT OR IGNORE INTO programs (program_code, program_name, description, department, degree_type, duration_years, total_units, status)
      VALUES ('BSIT', 'Bachelor of Science in Information Technology', 'BSIT Program - Informatics College', 'College of Information Technology', 'Bachelor', 4, 152, 'Active')
    `).run();
    db.prepare(`
      INSERT OR IGNORE INTO programs (program_code, program_name, description, department, degree_type, duration_years, total_units, status)
      VALUES ('BSCS', 'Bachelor of Science in Computer Science', 'BSCS Program - Informatics College', 'College of Computer Studies', 'Bachelor', 4, 157, 'Active')
    `).run();
    console.log('✅ Programs created (BSIT + BSCS)');

    // Seed school year 2023-2024 (inactive, for Juan's historical data)
    db.prepare(`
      INSERT OR IGNORE INTO school_years (school_year, start_date, end_date, enrollment_start, enrollment_end, is_active)
      VALUES ('2023-2024', '2023-08-01', '2024-05-31', '2023-07-01', '2023-08-15', 0)
    `).run();
    const syOld = db.prepare("SELECT id FROM school_years WHERE school_year = '2023-2024'").get() as any;
    if (syOld) {
      const insertSemOld = db.prepare(`INSERT OR IGNORE INTO semesters (school_year_id, semester_number, semester_name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?)`);
      insertSemOld.run(syOld.id, 1, '1st Trimester', '2023-08-01', '2023-11-30', 0);
      insertSemOld.run(syOld.id, 2, '2nd Trimester', '2023-12-01', '2024-03-31', 0);
      insertSemOld.run(syOld.id, 3, '3rd Trimester', '2024-04-01', '2024-05-31', 0);
    }
    console.log('✅ School year 2023-2024 created (inactive)');

    // Seed school year 2024-2025 (active)
    db.prepare(`
      INSERT OR IGNORE INTO school_years (school_year, start_date, end_date, enrollment_start, enrollment_end, is_active)
      VALUES ('2024-2025', '2024-08-01', '2025-05-31', '2024-07-01', '2024-08-15', 1)
    `).run();
    console.log('✅ School year 2024-2025 created (active)');

    // Seed semesters for 2024-2025
    const syRow = db.prepare("SELECT id FROM school_years WHERE school_year = '2024-2025'").get() as any;
    if (syRow) {
      const insertSem = db.prepare(`INSERT OR IGNORE INTO semesters (school_year_id, semester_number, semester_name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?)`);
      insertSem.run(syRow.id, 1, '1st Trimester', '2024-08-01', '2024-11-30', 1);
      insertSem.run(syRow.id, 2, '2nd Trimester', '2024-12-01', '2025-03-31', 0);
      insertSem.run(syRow.id, 3, '3rd Trimester', '2025-04-01', '2025-05-31', 0);
      console.log('✅ Semesters for 2024-2025 created');
    }

    // Link all BSIT subjects to the curriculum table
    const bsitProgram = db.prepare("SELECT id FROM programs WHERE program_code = 'BSIT'").get() as any;
    if (bsitProgram) {
      const allBsitSubjects = db.prepare("SELECT id, year_level, semester FROM subjects WHERE course = 'BSIT'").all() as any[];
      const insertCurr = db.prepare(`
        INSERT OR IGNORE INTO curriculum (program_id, subject_id, year_level, semester, is_core)
        VALUES (?, ?, ?, ?, 1)
      `);
      const seedCurriculum = db.transaction((subs: any[]) => {
        for (const s of subs) {
          insertCurr.run(bsitProgram.id, s.id, s.year_level, s.semester);
        }
      });
      seedCurriculum(allBsitSubjects);
      console.log(`✅ Curriculum seeded: ${allBsitSubjects.length} BSIT subjects linked`);
    }

    // Link BSCS subjects + shared GE/PE subjects to BSCS curriculum
    const bscsProgram = db.prepare("SELECT id FROM programs WHERE program_code = 'BSCS'").get() as any;
    if (bscsProgram) {
      // BSCS-specific subjects
      const allBscsSubjects = db.prepare("SELECT id, year_level, semester FROM subjects WHERE course = 'BSCS'").all() as any[];
      const insertCurrBscs = db.prepare(`
        INSERT OR IGNORE INTO curriculum (program_id, subject_id, year_level, semester, is_core)
        VALUES (?, ?, ?, ?, 1)
      `);
      const seedBscsCurriculum = db.transaction((subs: any[]) => {
        for (const s of subs) {
          insertCurrBscs.run(bscsProgram.id, s.id, s.year_level, s.semester);
        }
      });
      seedBscsCurriculum(allBscsSubjects);

      // Shared GE/PE/NSTP subjects from BSIT mapped into BSCS curriculum
      const sharedMappings = [
        // Year 1 T1
        ['GE111', 1, '1st'], ['GE112', 1, '1st'], ['GE113', 1, '1st'], ['NSTP1', 1, '1st'], ['PE1', 1, '1st'],
        // Year 1 T2
        ['GE124', 1, '2nd'], ['NSTP2', 1, '2nd'], ['PE2', 1, '2nd'],
        // Year 1 T3
        ['GE135', 1, '3rd'], ['PE3', 1, '3rd'],
        // Year 2 T1
        ['GE211', 2, '1st'], ['GE212', 2, '1st'], ['PE4', 2, '1st'],
        // Year 2 T2
        ['GE224', 2, '2nd'], ['GE225', 2, '2nd'],
        // Year 2 T3
        ['GE236', 2, '3rd'],
        // Year 3 T1 (no shared GE)
        // Year 3 T2
        ['GE321', 3, '2nd']
      ];
      for (const [code, yr, sem] of sharedMappings) {
        const subRow = db.prepare('SELECT id FROM subjects WHERE subject_code = ?').get(code) as any;
        if (subRow) {
          insertCurrBscs.run(bscsProgram.id, subRow.id, yr, sem);
        }
      }
      console.log(`✅ BSCS curriculum seeded: ${allBscsSubjects.length} unique + shared GE/PE subjects`);
    }

    // Insert or update default course fees - hardcoded for reliability
    try {
      const defaultCourseFees = ['BSIT', 'BSCS'];
      
      // Also grab any additional courses from subjects table
      const subjectCourses = db.prepare('SELECT DISTINCT course FROM subjects WHERE course IS NOT NULL AND course != ""').all();
      for (const sc of subjectCourses) {
        if (!defaultCourseFees.includes((sc as any).course)) {
          defaultCourseFees.push((sc as any).course);
        }
      }

      const upsertCourseFee = db.prepare(`
        INSERT INTO courses_fees (course, tuition_per_unit, registration, library, lab, id_fee, others)
        VALUES (?, 700.00, 1500.00, 500.00, 2000.00, 200.00, 300.00)
        ON CONFLICT(course) DO UPDATE SET
          tuition_per_unit = CASE WHEN tuition_per_unit = 0 OR tuition_per_unit IS NULL THEN 700.00 ELSE tuition_per_unit END,
          registration = CASE WHEN registration = 0 OR registration IS NULL THEN 1500.00 ELSE registration END,
          library = CASE WHEN library = 0 OR library IS NULL THEN 500.00 ELSE library END,
          lab = CASE WHEN lab = 0 OR lab IS NULL THEN 2000.00 ELSE lab END,
          id_fee = CASE WHEN id_fee = 0 OR id_fee IS NULL THEN 200.00 ELSE id_fee END,
          others = CASE WHEN others = 0 OR others IS NULL THEN 300.00 ELSE others END,
          updated_at = datetime('now')
      `);
      
      for (const courseName of defaultCourseFees) {
        upsertCourseFee.run(courseName);
      }
      
      console.log(`✅ Initialized fees for ${defaultCourseFees.length} courses: ${defaultCourseFees.join(', ')}`);
    } catch (e) {
      console.log('⚠️ Could not initialize course fees:', e);
    }

    // Insert sample students (password: student123)
    const studentPassword = await bcrypt.hash('student123', 10);
    
    const sampleStudentUsers = [
      ['juan.delacruz', studentPassword, 'student', 'juan.delacruz@student.informatics.edu'],
      ['maria.santos', studentPassword, 'student', 'maria.santos@student.informatics.edu'],
      ['pedro.reyes', studentPassword, 'student', 'pedro.reyes@student.informatics.edu'],
      ['ana.garcia', studentPassword, 'student', 'ana.garcia@student.informatics.edu'],
      ['carlos.lopez', studentPassword, 'student', 'carlos.lopez@student.informatics.edu']
    ];

    const insertStudentUser = db.prepare('INSERT OR IGNORE INTO users (username, password, role, email) VALUES (?, ?, ?, ?)');
    const insertManySampleUsers = db.transaction((users: any[]) => {
      for (const user of users) {
        insertStudentUser.run(user);
      }
    });
    
    insertManySampleUsers(sampleStudentUsers);
    console.log('✅ Sample student users created');

    // Get all student users
    const allStudentUsers = await query('SELECT id, username FROM users WHERE username IN (?, ?, ?, ?, ?)', 
      ['juan.delacruz', 'maria.santos', 'pedro.reyes', 'ana.garcia', 'carlos.lopez']);

    // Sample student data
    const sampleStudentData = [
      {
        username: 'juan.delacruz',
        student_id: '2024-001234',
        first_name: 'Juan',
        middle_name: 'Santos',
        last_name: 'Dela Cruz',
        suffix: null,
        student_type: 'Continuing',
        course: 'BSCS',
        year_level: 2,
        contact_number: '09171234567',
        address: '123 Rizal Street, Manila City',
        birth_date: '2004-05-15',
        gender: 'Male'
      },
      {
        username: 'maria.santos',
        student_id: '2024-001235',
        first_name: 'Maria',
        middle_name: 'Reyes',
        last_name: 'Santos',
        suffix: null,
        student_type: 'New',
        course: 'BSCS',
        year_level: 1,
        contact_number: '09187654321',
        address: '456 Bonifacio Avenue, Quezon City',
        birth_date: '2005-08-22',
        gender: 'Female'
      },
      {
        username: 'pedro.reyes',
        student_id: '2024-001236',
        first_name: 'Pedro',
        middle_name: 'Garcia',
        last_name: 'Reyes',
        suffix: 'Jr.',
        student_type: 'Transferee',
        course: 'BSIT',
        year_level: 2,
        contact_number: '09191234567',
        address: '789 Luna Street, Makati City',
        birth_date: '2003-12-10',
        gender: 'Male'
      },
      {
        username: 'ana.garcia',
        student_id: '2024-001237',
        first_name: 'Ana',
        middle_name: 'Lopez',
        last_name: 'Garcia',
        suffix: null,
        student_type: 'Scholar',
        course: 'BSCS',
        year_level: 1,
        contact_number: '09201234567',
        address: '321 Mabini Street, Pasig City',
        birth_date: '2005-03-18',
        gender: 'Female'
      },
      {
        username: 'carlos.lopez',
        student_id: '2024-001238',
        first_name: 'Carlos',
        middle_name: 'Mendoza',
        last_name: 'Lopez',
        suffix: null,
        student_type: 'Returning',
        course: 'BSIT',
        year_level: 3,
        contact_number: '09211234567',
        address: '654 Del Pilar Street, Taguig City',
        birth_date: '2002-07-25',
        gender: 'Male'
      }
    ];

    const insertStudent = db.prepare(`
      INSERT OR IGNORE INTO students (
        user_id, student_id, first_name, middle_name, last_name, suffix,
        student_type, course, year_level, contact_number, address, birth_date, gender, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `);

    const insertManySampleStudents = db.transaction((students: any[]) => {
      for (const student of students) {
        const user = allStudentUsers.find((u: any) => u.username === student.username);
        if (user) {
          insertStudent.run(
            user.id, student.student_id, student.first_name, student.middle_name,
            student.last_name, student.suffix, student.student_type, student.course,
            student.year_level, student.contact_number, student.address,
            student.birth_date, student.gender
          );
        }
      }
    });

    insertManySampleStudents(sampleStudentData);
    console.log('✅ Sample students created');

    // Add pre-existing documents for continuing student (Juan Dela Cruz)
    const juanStudent = await query('SELECT id FROM students WHERE student_id = ?', ['2024-001234']);
    if (juanStudent.length > 0) {
      const juanId = juanStudent[0].id;
      const juanDocs = [
        { type: 'diploma', name: 'juandelacruz_diploma.pdf', path: '/uploads/documents/juandelacruz_diploma.pdf', size: 245000 },
        { type: 'picture_2x2', name: 'juandelacruz_2x2_photo.jpg', path: '/uploads/documents/juandelacruz_2x2_photo.jpg', size: 125000 },
        { type: 'form137', name: 'juandelacruz_form137.pdf', path: '/uploads/documents/juandelacruz_form137.pdf', size: 189000 },
        { type: 'birth_certificate', name: 'juandelacruz_birth_certificate.pdf', path: '/uploads/documents/juandelacruz_birth_certificate.pdf', size: 156000 },
      ];
      const insertDoc = db.prepare(`
        INSERT OR IGNORE INTO documents (student_id, document_type, file_name, file_path, file_size, status, verified_by, verified_at)
        VALUES (?, ?, ?, ?, ?, 'Verified', 1, datetime('now'))
      `);
      const insertManyDocs = db.transaction((docs: any[]) => {
        for (const d of docs) {
          insertDoc.run(juanId, d.type, d.name, d.path, d.size);
        }
      });
      insertManyDocs(juanDocs);
      console.log('✅ Pre-existing documents added for Juan Dela Cruz (Continuing)');

      // Mark Juan as grades complete for Year 1
      db.prepare('UPDATE students SET grades_complete = 1 WHERE id = ?').run(juanId);

      // Seed Juan's Year 1 completed enrollments (2023-2024, all 3 trimesters)
      const juanTrimesters = ['1st', '2nd', '3rd'];
      for (const sem of juanTrimesters) {
        db.prepare(`
          INSERT OR IGNORE INTO enrollments (student_id, school_year, semester, status, created_at, updated_at)
          VALUES (?, '2023-2024', ?, 'Enrolled', datetime('now'), datetime('now'))
        `).run(juanId, sem);
      }
      console.log('✅ Juan Year 1 enrollments created (2023-2024)');

      // Get Juan's enrollment IDs and seed grades
      const juanEnrollments = db.prepare(
        "SELECT id, semester FROM enrollments WHERE student_id = ? AND school_year = '2023-2024' ORDER BY id"
      ).all(juanId) as any[];

      // BSCS Year 1 subjects by semester
      const bscsY1Subjects: Record<string, string[]> = {
        '1st': ['GE111', 'GE112', 'GE113', 'NSTP1', 'PE1', 'CSP111', 'CSP112'],
        '2nd': ['GE124', 'NSTP2', 'PE2', 'CSP121', 'CSP122'],
        '3rd': ['GE135', 'PE3', 'CSP131', 'CSP132']
      };
      const gradeValues = ['1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50'];
      let gradeIdx = 0;
      for (const enrollment of juanEnrollments) {
        const subjectCodes = bscsY1Subjects[enrollment.semester] || [];
        for (const code of subjectCodes) {
          // Find subject from BSCS-specific or shared BSIT subjects
          const subRow = db.prepare('SELECT id FROM subjects WHERE subject_code = ?').get(code) as any;
          if (subRow) {
            db.prepare(`
              INSERT OR IGNORE INTO enrollment_subjects (enrollment_id, subject_id, status, grade)
              VALUES (?, ?, 'Completed', ?)
            `).run(enrollment.id, subRow.id, gradeValues[gradeIdx % gradeValues.length]);
            gradeIdx++;
          }
        }
      }
      console.log(`✅ Juan Year 1 grades seeded (${gradeIdx} subjects across 3 trimesters)`);
    }

    // Seed sample requirements data for Juan (Continuing student)
    try {
      const juanStudent: any = db.prepare('SELECT id FROM students WHERE student_id = ?').get('2024-001234');
      if (juanStudent) {
        // Sample submitted requirements (Initial Requirements)
        db.prepare(`
          INSERT OR IGNORE INTO student_requirements 
          (student_id, requirement_name, requirement_type, status, file_path, file_name, hard_copy_submitted)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(juanStudent.id, 'Birth Certificate', 'Initial', 'Verified', '/uploads/documents/juan-birth-cert.pdf', 'juan-birth-cert.pdf', 1);
        
        db.prepare(`
          INSERT OR IGNORE INTO student_requirements 
          (student_id, requirement_name, requirement_type, status, file_path, file_name, hard_copy_submitted)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(juanStudent.id, 'Certificate of Good Moral', 'Initial', 'Submitted', '/uploads/documents/juan-moral-cert.pdf', 'juan-moral-cert.pdf', 0);

        // Sample INC requirement (Incomplete - needs resubmission)
        db.prepare(`
          INSERT OR IGNORE INTO student_requirements 
          (student_id, requirement_name, requirement_type, status, file_path, file_name, remarks)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(juanStudent.id, 'Medical Certificate', 'INC', 'Rejected', '/uploads/documents/juan-medical-old.pdf', 'juan-medical-old.pdf', 'Medical cert expired. Please submit current one.');

        console.log('✅ Sample requirements data seeded for Juan Dela Cruz');
      }
    } catch (err) {
      console.error('⚠️ Error seeding requirements for Juan:', err);
    }

    // Seed sections (Section 1 and Section 2)
    db.exec(`
      INSERT OR IGNORE INTO sections (section_code, section_name, course, year_level, school_year, semester, status)
      VALUES ('1', 'Section 1', 'BSCS', 1, '2024-2025', '1st', 'Active');
    `);
    db.exec(`
      INSERT OR IGNORE INTO sections (section_code, section_name, course, year_level, school_year, semester, status)
      VALUES ('2', 'Section 2', 'BSCS', 1, '2024-2025', '1st', 'Active');
    `);
    console.log('✅ Sections seeded (Section 1, Section 2)');

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\nDefault credentials:');
    console.log('  Superadmin: superadmin / admin123');
    console.log('  Admin: admin1 / admin123');
    console.log('  Dean: dean1 / admin123');
    console.log('  Registrar: registrar1 / admin123');
    console.log('  Cashier: cashier1 / admin123');
    console.log('\nSample students (password: student123):');
    console.log('  juan.delacruz - Juan Santos Dela Cruz (Continuing | BSCS | Year 2) | ID: 2024-001234');
    console.log('  maria.santos - Maria Reyes Santos (New | BSCS | Year 1) | ID: 2024-001235');
    console.log('  pedro.reyes - Pedro Garcia Reyes Jr. (Transferee | BSIT | Year 2) | ID: 2024-001236');
    console.log('  ana.garcia - Ana Lopez Garcia (Scholar | BSCS | Year 1) | ID: 2024-001237');
    console.log('  carlos.lopez - Carlos Mendoza Lopez (Returning | BSIT | Year 3) | ID: 2024-001238');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase().then(() => {
  db.close();
  process.exit(0);
}).catch((error) => {
  console.error('❌ Setup failed:', error);
  db.close();
  process.exit(1);
});
