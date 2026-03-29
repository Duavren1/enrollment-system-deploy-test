/**
 * SQLite → PostgreSQL Migration Script
 * 
 * This script reads your SQLite database and exports all data as
 * PostgreSQL-compatible INSERT statements that you can run in Supabase SQL Editor.
 * 
 * Usage:
 *   cd src/backend-setup
 *   npx ts-node src/scripts/export-to-postgres.ts > supabase_data.sql
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../enrollment_system.db');
const db = new Database(dbPath, { readonly: true });

// Tables in dependency order (parents before children)
const TABLES_IN_ORDER = [
  'users',
  'faculty',
  'students',
  'sections',
  'school_years',
  'semesters',
  'programs',
  'subjects',
  'curriculum',
  'enrollments',
  'enrollment_subjects',
  'enrollment_subject_audit',
  'documents',
  'transactions',
  'installment_payments',
  'promissory_notes',
  'activity_logs',
  'notifications',
  'clearances',
  'cors',
  'system_settings',
  'courses_fees',
  'subject_schedules',
  'pre_registrations',
  'student_requirements',
  'ovr_requests',
  'grade_approvals',
  'scholarship_applications',
];

function escapeValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  // Escape single quotes
  const escaped = String(val).replace(/'/g, "''");
  return `'${escaped}'`;
}

function exportTable(tableName: string) {
  try {
    // Check if table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(tableName);

    if (!tableExists) {
      console.log(`-- Table ${tableName} does not exist, skipping`);
      return;
    }

    const rows = db.prepare(`SELECT * FROM ${tableName}`).all() as any[];
    
    if (rows.length === 0) {
      console.log(`-- Table ${tableName} is empty, skipping`);
      return;
    }

    const columns = Object.keys(rows[0]);

    console.log(`\n-- =============================================`);
    console.log(`-- ${tableName} (${rows.length} rows)`);
    console.log(`-- =============================================`);

    for (const row of rows) {
      const values = columns.map(col => escapeValue(row[col]));
      console.log(
        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`
      );
    }

    // Reset the sequence to the max id so future inserts work
    const maxId = db.prepare(`SELECT MAX(id) as max_id FROM ${tableName}`).get() as any;
    if (maxId?.max_id) {
      console.log(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), ${maxId.max_id});`);
    }
  } catch (err: any) {
    console.log(`-- ERROR exporting ${tableName}: ${err.message}`);
  }
}

// Header
console.log('-- ============================================================');
console.log('-- Enrollment System: SQLite → PostgreSQL Data Migration');
console.log(`-- Generated: ${new Date().toISOString()}`);
console.log('-- Run this AFTER creating tables with supabase_schema.sql');
console.log('-- ============================================================');
console.log('');
console.log('BEGIN;');

for (const table of TABLES_IN_ORDER) {
  exportTable(table);
}

console.log('\nCOMMIT;');
console.log('\n-- Migration complete!');

db.close();
