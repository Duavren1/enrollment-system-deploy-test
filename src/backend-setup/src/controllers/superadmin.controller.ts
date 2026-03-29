import { Response } from 'express';
import { query, run } from '../database/connection';
import { AuthRequest } from '../middleware/auth.middleware';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
// Database import removed — using PostgreSQL via connection module

// User Management (Admin, Dean, Registrar)
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.query;

    let sql = 'SELECT id, username, role, email, created_at FROM users WHERE role != ?';
    const params: any[] = ['student'];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    sql += ' ORDER BY created_at DESC';

    const users = await query(sql, params);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, role, email } = req.body;

    // Validate role
    if (!['admin', 'dean', 'registrar', 'cashier'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, dean, registrar, or cashier'
      });
    }

    const hashedPassword = await bcrypt.hash(password || 'admin123', 10);

    const result = await run(
      'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, role, email || null]
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { id: result.lastInsertRowid }
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: error.message?.includes('UNIQUE') ? 'Username already exists' : 'Server error'
    });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { username, password, role, email } = req.body;

    const existing = await query('SELECT role FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Allow superadmin updates ONLY for profile changes (username, email, password)
    // Role changes for superadmin must use reassignSuperadmin endpoint
    if (existing[0].role === 'superadmin' && role && role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Use reassignSuperadmin endpoint to change superadmin role'
      });
    }

    let updateFields: any = {};
    const params: any[] = [];

    if (username) updateFields.username = username;
    if (email) updateFields.email = email;
    if (password) {
      updateFields.password = await bcrypt.hash(password, 10);
    }
    // Only allow role changes for non-superadmin users
    if (role && role !== 'superadmin' && ['admin', 'dean', 'registrar', 'cashier'].includes(role)) {
      if (existing[0].role !== 'superadmin') {
        updateFields.role = role;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const setClause = Object.keys(updateFields)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updateFields);

    await run(
      `UPDATE users SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
      [...values, id]
    );

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT role FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If deleting superadmin, ensure another superadmin exists
    if (existing[0].role === 'superadmin') {
      const otherSuperadmins = await query(
        'SELECT id FROM users WHERE role = ? AND id != ?',
        ['superadmin', id]
      );
      
      if (otherSuperadmins.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete the only superadmin. Please reassign the superadmin role first.'
        });
      }
    }

    await run('DELETE FROM users WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Reassign superadmin role to another user
export const reassignSuperadmin = async (req: AuthRequest, res: Response) => {
  try {
    const { newSuperadminId, demoteCurrentTo } = req.body;

    // Validate inputs
    if (!newSuperadminId) {
      return res.status(400).json({
        success: false,
        message: 'newSuperadminId is required'
      });
    }

    // Get current superadmin
    const currentSuperadmin = await query(
      'SELECT id, username FROM users WHERE role = ?',
      ['superadmin']
    );

    if (currentSuperadmin.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No current superadmin found'
      });
    }

    // Get new superadmin candidate
    const newSuperadmin = await query(
      'SELECT id, username, role FROM users WHERE id = ?',
      [newSuperadminId]
    );

    if (newSuperadmin.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User to promote not found'
      });
    }

    // Verify it's not already the superadmin
    if (newSuperadmin[0].id === currentSuperadmin[0].id) {
      return res.status(400).json({
        success: false,
        message: 'User is already the superadmin'
      });
    }

    // Determine role to demote current superadmin to (default: admin)
    const newRole = demoteCurrentTo && ['admin', 'dean', 'registrar', 'cashier'].includes(demoteCurrentTo) 
      ? demoteCurrentTo 
      : 'admin';

    // Execute transaction: demote current + promote new
    await run(
      "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?",
      [newRole, currentSuperadmin[0].id]
    );

    await run(
      "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?",
      ['superadmin', newSuperadminId]
    );

    // Log the action
    await run(
      'INSERT INTO activity_logs (user_id, action, entity_type, description) VALUES (?, ?, ?, ?)',
      [
        req.user?.id,
        'SUPERADMIN_REASSIGNMENT',
        'users',
        `Superadmin role transferred from ${currentSuperadmin[0].username} to ${newSuperadmin[0].username}. ${currentSuperadmin[0].username} demoted to ${newRole}.`
      ]
    );

    res.json({
      success: true,
      message: 'Superadmin role successfully reassigned',
      data: {
        previousSuperadmin: {
          id: currentSuperadmin[0].id,
          username: currentSuperadmin[0].username,
          newRole: newRole
        },
        newSuperadmin: {
          id: newSuperadmin[0].id,
          username: newSuperadmin[0].username,
          previousRole: newSuperadmin[0].role
        }
      }
    });
  } catch (error) {
    console.error('Reassign superadmin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Database Backup (PostgreSQL — managed by Supabase)
export const backupDatabase = async (req: AuthRequest, res: Response) => {
  try {
    const timestamp = new Date().toISOString();

    // Log activity
    await run(
      'INSERT INTO activity_logs (user_id, action, entity_type, description) VALUES (?, ?, ?, ?)',
      [req.user?.id, 'DATABASE_BACKUP', 'system', `Database backup requested at ${timestamp}. Note: Supabase handles automated backups.`]
    );

    res.json({
      success: true,
      message: 'Backup logged. Supabase provides automatic daily backups for your database.',
      data: {
        backupPath: 'supabase-managed',
        timestamp
      }
    });
  } catch (error) {
    console.error('Backup database error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get superadmin dashboard stats
export const getSuperadminDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    // Total users (excluding students)
    const totalUsers = await query(
      "SELECT COUNT(*) as count FROM users WHERE role != 'student'"
    );

    // Active sessions (users who logged in recently - simplified)
    const recentLogins = await query(
      `SELECT COUNT(DISTINCT user_id) as count 
       FROM activity_logs 
       WHERE action = 'LOGIN' 
       AND datetime(created_at) > datetime('now', '-1 hour')`
    );

    // System health (check if database is accessible)
    const dbHealth = await query('SELECT 1 as healthy');

    // Recent activity count
    const recentActivity = await query(
      `SELECT COUNT(*) as count 
       FROM activity_logs 
       WHERE datetime(created_at) > datetime('now', '-24 hours')`
    );

    // Total active users per role (5 minute interval)
    const totalActiveUsers = await query(
      `SELECT COUNT(DISTINCT user_id) as count 
       FROM activity_logs 
       WHERE datetime(created_at) > datetime('now', '-5 minutes')`
    );

    // Active users breakdown by role
    const activeUsersByRole = await query(
      `SELECT u.role, COUNT(DISTINCT l.user_id) as count
       FROM activity_logs l
       JOIN users u ON u.id = l.user_id
       WHERE datetime(l.created_at) > datetime('now', '-5 minutes')
       GROUP BY u.role
       ORDER BY u.role`
    );

    // Convert active users by role to object
    const activeUsersByRoleObj: { [key: string]: number } = {};
    activeUsersByRole.forEach((row: any) => {
      activeUsersByRoleObj[row.role] = row.count;
    });

    // Total logins per day (today)
    const totalLoginsPerDay = await query(
      `SELECT COUNT(*) as count 
       FROM activity_logs 
       WHERE action = 'LOGIN'
       AND date(created_at) = date('now')`
    );

    // Number of enrollments submitted per day (today)
    const enrollmentsSubmittedPerDay = await query(
      `SELECT COUNT(*) as count 
       FROM enrollments 
       WHERE date(created_at) = date('now')`
    );

    // Number of enrollments approved per day (today)
    const approvedPerDay = await query(
      `SELECT COUNT(*) as count 
       FROM enrollments 
       WHERE status = 'Enrolled'
       AND date(updated_at) = date('now')`
    );

    // Recent activity logs (latest 10)
    const activityLog = await query(
      `SELECT l.*, u.username
       FROM activity_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers[0]?.count || 0,
        activeSessions: recentLogins[0]?.count || 0,
        systemHealth: dbHealth.length > 0 ? 'OK' : 'Error',
        recentActivity: recentActivity[0]?.count || 0,
        totalActiveUsers: totalActiveUsers[0]?.count || 0,
        activeUsersByRole: activeUsersByRoleObj,
        totalLoginsPerDay: totalLoginsPerDay[0]?.count || 0,
        enrollmentsSubmittedPerDay: enrollmentsSubmittedPerDay[0]?.count || 0,
        approvedPerDay: approvedPerDay[0]?.count || 0,
        activityLog
      }
    });
  } catch (error) {
    console.error('Get superadmin dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
