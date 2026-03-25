import { Response } from 'express';
import { query, run } from '../database/connection';
import { AuthRequest } from '../middleware/auth.middleware';

// Get grades for a student (SHS or College)
export const getStudentGrades = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { school_year, semester, subject_type } = req.query;

    let sql = `
      SELECT 
        es.*,
        s.subject_code,
        s.subject_name,
        s.units,
        s.subject_type,
        e.school_year,
        e.semester,
        st.student_id,
        st.first_name || ' ' || st.last_name as student_name
      FROM enrollment_subjects es
      JOIN enrollments e ON es.enrollment_id = e.id
      JOIN subjects s ON es.subject_id = s.id
      JOIN students st ON e.student_id = st.id
      WHERE st.student_id = ?
    `;
    const params: any[] = [studentId];

    if (school_year) {
      sql += ' AND e.school_year = ?';
      params.push(school_year);
    }
    if (semester) {
      sql += ' AND e.semester = ?';
      params.push(semester);
    }
    if (subject_type) {
      sql += ' AND s.subject_type = ?';
      params.push(subject_type);
    }

    sql += ' ORDER BY e.school_year DESC, e.semester, s.subject_code';

    const grades = await query(sql, params);

    res.json({
      success: true,
      data: grades
    });
  } catch (error) {
    console.error('Get student grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get grades for the currently logged-in student (secure — uses JWT user id)
export const getMyGrades = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { school_year, semester, subject_type } = req.query;

    let sql = `
      SELECT 
        es.*,
        s.subject_code,
        s.subject_name,
        s.units,
        s.subject_type,
        e.school_year,
        e.semester,
        st.student_id,
        st.first_name || ' ' || st.last_name as student_name
      FROM enrollment_subjects es
      JOIN enrollments e ON es.enrollment_id = e.id
      JOIN subjects s ON es.subject_id = s.id
      JOIN students st ON e.student_id = st.id
      WHERE st.user_id = ?
    `;
    const params: any[] = [userId];

    if (school_year) {
      sql += ' AND e.school_year = ?';
      params.push(school_year);
    }
    if (semester) {
      sql += ' AND e.semester = ?';
      params.push(semester);
    }
    if (subject_type) {
      sql += ' AND s.subject_type = ?';
      params.push(subject_type);
    }

    sql += ' ORDER BY e.school_year DESC, e.semester, s.subject_code';

    const grades = await query(sql, params);

    res.json({
      success: true,
      data: grades
    });
  } catch (error) {
    console.error('Get my grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update grade for a specific enrollment subject
export const updateGrade = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { grade } = req.body;
    const userId = req.user?.id;

    await run(
      `UPDATE enrollment_subjects SET 
        grade = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE id = ?`,
      [grade, id]
    );

    // Log activity
    await run(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId, 'UPDATE_GRADE', 'enrollment_subject', id, `Updated grade to ${grade}`]
    );

    res.json({
      success: true,
      message: 'Grade updated successfully'
    });
  } catch (error) {
    console.error('Update grade error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Bulk update grades
export const bulkUpdateGrades = async (req: AuthRequest, res: Response) => {
  try {
    const { grades } = req.body; // Array of { enrollment_subject_id, grade }
    const userId = req.user?.id;

    // Ensure grade_status column exists
    try {
      const tableInfo = await query("PRAGMA table_info(enrollment_subjects)");
      const hasGradeStatus = (tableInfo || []).some((c: any) => c.name === 'grade_status');
      if (!hasGradeStatus) {
        await run("ALTER TABLE enrollment_subjects ADD COLUMN grade_status TEXT DEFAULT NULL");
      }
    } catch (e) {}

    const updatePromises = grades.map((g: any) =>
      run(
        `UPDATE enrollment_subjects SET grade = ?, grade_status = 'Submitted', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
        [g.grade, g.enrollment_subject_id]
      )
    );

    await Promise.all(updatePromises);

    // Log activity
    await run(
      'INSERT INTO activity_logs (user_id, action, entity_type, description) VALUES (?, ?, ?, ?)',
      [userId, 'BULK_UPDATE_GRADES', 'enrollment_subject', `Bulk updated ${grades.length} grades and submitted for dean approval`]
    );

    res.json({
      success: true,
      message: `${grades.length} grades updated and submitted for dean approval`
    });
  } catch (error) {
    console.error('Bulk update grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get grades pending dean approval
export const getPendingGrades = async (req: AuthRequest, res: Response) => {
  try {
    // Ensure grade_status column exists
    try {
      const tableInfo = await query("PRAGMA table_info(enrollment_subjects)");
      const hasGradeStatus = (tableInfo || []).some((c: any) => c.name === 'grade_status');
      if (!hasGradeStatus) {
        await run("ALTER TABLE enrollment_subjects ADD COLUMN grade_status TEXT DEFAULT NULL");
      }
    } catch (e) {}

    const grades = await query(
      `SELECT 
        es.id,
        es.enrollment_id,
        es.subject_id,
        es.grade,
        es.grade_status,
        REPLACE(CASE WHEN es.updated_at LIKE '%Z' THEN es.updated_at ELSE es.updated_at || 'Z' END, ' ', 'T') as updated_at,
        s.subject_code,
        s.subject_name,
        s.units,
        st.student_id,
        st.first_name || ' ' || st.last_name as student_name,
        st.course,
        st.year_level,
        e.school_year,
        e.semester
      FROM enrollment_subjects es
      JOIN enrollments e ON es.enrollment_id = e.id
      JOIN subjects s ON es.subject_id = s.id
      JOIN students st ON e.student_id = st.id
      WHERE es.grade IS NOT NULL AND es.grade != '' AND es.grade_status = 'Submitted'
      ORDER BY es.updated_at DESC`
    );

    res.json({
      success: true,
      data: grades
    });
  } catch (error) {
    console.error('Get pending grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get grades by section/subject
export const getGradesBySection = async (req: AuthRequest, res: Response) => {
  try {
    const { sectionId, subjectId } = req.query;

    let sql = `
      SELECT 
        es.*,
        s.subject_code,
        s.subject_name,
        st.student_id,
        st.first_name || ' ' || st.last_name as student_name,
        e.school_year,
        e.semester
      FROM enrollment_subjects es
      JOIN enrollments e ON es.enrollment_id = e.id
      JOIN subjects s ON es.subject_id = s.id
      JOIN students st ON e.student_id = st.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (subjectId) {
      sql += ' AND s.id = ?';
      params.push(subjectId);
    }

    sql += ' ORDER BY st.last_name, st.first_name';

    const grades = await query(sql, params);

    res.json({
      success: true,
      data: grades
    });
  } catch (error) {
    console.error('Get grades by section error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Approve/finalize a grade (Dean action) - records approval in a lightweight approvals table
export const approveGrade = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // enrollment_subject id
    const { remarks } = req.body;
    const userId = req.user?.id;

    // Ensure table exists
    await run(`CREATE TABLE IF NOT EXISTS grade_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      enrollment_subject_id INTEGER,
      approved_by INTEGER,
      remarks TEXT,
      approved_at TEXT
    )`);

    const result = await run(
      `INSERT INTO grade_approvals (enrollment_subject_id, approved_by, remarks, approved_at) VALUES (?, ?, ?, datetime('now'))`,
      [id, userId, remarks || null]
    );

    // Update grade_status to 'Approved'
    try {
      await run(
        `UPDATE enrollment_subjects SET grade_status = 'Approved', updated_at = datetime('now', 'utc') || 'Z' WHERE id = ?`,
        [id]
      );
    } catch (e) {
      console.warn('Could not update grade_status:', e);
    }

    // Log activity
    await run(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId, 'APPROVE_GRADE', 'enrollment_subject', id, `Grade approved by user ${userId}`]
    );

    res.json({ success: true, message: 'Grade approved successfully', data: { id: result.lastInsertRowid } });
  } catch (error) {
    console.error('Approve grade error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get approved/finalized grades
export const getApprovedGrades = async (req: AuthRequest, res: Response) => {
  try {
    // Ensure grade_status column exists
    try {
      const tableInfo = await query("PRAGMA table_info(enrollment_subjects)");
      const hasGradeStatus = (tableInfo || []).some((c: any) => c.name === 'grade_status');
      if (!hasGradeStatus) {
        await run("ALTER TABLE enrollment_subjects ADD COLUMN grade_status TEXT DEFAULT NULL");
      }
    } catch (e) {}

    const grades = await query(
      `SELECT 
        es.id,
        es.enrollment_id,
        es.subject_id,
        es.grade,
        es.grade_status,
        REPLACE(CASE WHEN es.updated_at LIKE '%Z' THEN es.updated_at ELSE es.updated_at || 'Z' END, ' ', 'T') as updated_at,
        s.subject_code,
        s.subject_name,
        s.units,
        st.student_id,
        st.first_name || ' ' || st.last_name as student_name,
        st.course,
        st.year_level,
        e.school_year,
        e.semester,
        u.username as approved_by
      FROM enrollment_subjects es
      JOIN enrollments e ON es.enrollment_id = e.id
      JOIN subjects s ON es.subject_id = s.id
      JOIN students st ON e.student_id = st.id
      LEFT JOIN grade_approvals ga ON es.id = ga.enrollment_subject_id
      LEFT JOIN users u ON ga.approved_by = u.id
      WHERE es.grade IS NOT NULL AND es.grade != '' AND es.grade_status = 'Approved'
      ORDER BY es.updated_at DESC`
    );

    res.json({
      success: true,
      data: grades
    });
  } catch (error) {
    console.error('Get approved grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get submitted grades pending dean approval (for registrar view)
export const getSubmittedGrades = async (req: AuthRequest, res: Response) => {
  try {
    // Ensure grade_status column exists
    try {
      const tableInfo = await query("PRAGMA table_info(enrollment_subjects)");
      const hasGradeStatus = (tableInfo || []).some((c: any) => c.name === 'grade_status');
      if (!hasGradeStatus) {
        await run("ALTER TABLE enrollment_subjects ADD COLUMN grade_status TEXT DEFAULT NULL");
      }
    } catch (e) {}

    const grades = await query(
      `SELECT 
        es.id,
        es.enrollment_id,
        es.subject_id,
        es.grade,
        es.grade_status,
        REPLACE(CASE WHEN es.updated_at LIKE '%Z' THEN es.updated_at ELSE es.updated_at || 'Z' END, ' ', 'T') as updated_at,
        s.subject_code,
        s.subject_name,
        s.units,
        st.student_id,
        st.first_name || ' ' || st.last_name as student_name,
        st.course,
        st.year_level,
        e.school_year,
        e.semester
      FROM enrollment_subjects es
      JOIN enrollments e ON es.enrollment_id = e.id
      JOIN subjects s ON es.subject_id = s.id
      JOIN students st ON e.student_id = st.id
      WHERE es.grade IS NOT NULL AND es.grade != '' AND es.grade_status = 'Submitted'
      ORDER BY es.updated_at DESC`
    );

    res.json({
      success: true,
      data: grades
    });
  } catch (error) {
    console.error('Get submitted grades error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
