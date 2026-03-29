import { Pool } from 'pg';
import dns from 'dns';
import dotenv from 'dotenv';

dotenv.config();

// Supabase resolves to IPv6 by default — ensure we prefer IPv6
dns.setDefaultResultOrder('verbatim');

// ──────────────────────────────────────────────
// PostgreSQL connection pool (Supabase)
// ──────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test connection
pool.query('SELECT 1')
  .then(() => {
    console.log('✅ PostgreSQL database connected successfully');
    console.log(`📁 Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);
  })
  .catch((err: any) => {
    console.error('❌ Database connection failed:', err.message);
  });

// ──────────────────────────────────────────────
// SQL Translation Helpers
// Convert SQLite ? placeholders → PostgreSQL $1, $2 ...
// Convert SQLite-specific functions → PostgreSQL equivalents
// ──────────────────────────────────────────────

function translateSQL(sql: string): string {
  let translated = sql;

  // Track if this was an INSERT OR IGNORE
  const wasInsertOrIgnore = /INSERT\s+OR\s+IGNORE\s+INTO/i.test(translated);

  // INSERT OR IGNORE → INSERT INTO ... ON CONFLICT DO NOTHING
  translated = translated.replace(
    /INSERT\s+OR\s+IGNORE\s+INTO/gi,
    'INSERT INTO'
  );

  // datetime('now', 'utc') || 'Z' → NOW() AT TIME ZONE 'UTC'
  translated = translated.replace(
    /datetime\s*\(\s*'now'\s*,\s*'utc'\s*\)\s*\|\|\s*'Z'/gi,
    "NOW() AT TIME ZONE 'UTC'"
  );

  // datetime('now', 'utc') → NOW() AT TIME ZONE 'UTC'
  translated = translated.replace(
    /datetime\s*\(\s*'now'\s*,\s*'utc'\s*\)/gi,
    "NOW() AT TIME ZONE 'UTC'"
  );

  // datetime('now', '-N hours/minutes/days') → NOW() + INTERVAL '-N hours'
  translated = translated.replace(
    /datetime\s*\(\s*'now'\s*,\s*'(-?\d+)\s+(hour|hours|minute|minutes|day|days|second|seconds)'\s*\)/gi,
    (_, num, unit) => `NOW() + INTERVAL '${num} ${unit}'`
  );

  // datetime('now') → NOW()
  translated = translated.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');

  // datetime(column) → column::timestamptz  (but not datetime('now') which was already replaced)
  translated = translated.replace(
    /datetime\s*\(\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\)/gi,
    '$1::timestamptz'
  );

  // date('now') → CURRENT_DATE
  translated = translated.replace(/date\s*\(\s*'now'\s*\)/gi, 'CURRENT_DATE');

  // strftime('%Y-%m-%dT%H:%M:%SZ', 'now') → TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  translated = translated.replace(
    /strftime\s*\(\s*'%Y-%m-%dT%H:%M:%SZ'\s*,\s*'now'\s*\)/gi,
    "TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')"
  );

  // strftime('%Y', col) → EXTRACT(YEAR FROM col)::text
  translated = translated.replace(
    /strftime\s*\(\s*'%Y'\s*,\s*([^)]+)\)/gi,
    "EXTRACT(YEAR FROM $1)::text"
  );

  // strftime('%Y-%m-%d', col) → TO_CHAR(col, 'YYYY-MM-DD')
  translated = translated.replace(
    /strftime\s*\(\s*'%Y-%m-%d'\s*,\s*([^)]+)\)/gi,
    "TO_CHAR($1, 'YYYY-MM-DD')"
  );

  // strftime('%Y', 'now') → EXTRACT(YEAR FROM NOW())::text
  translated = translated.replace(
    /strftime\s*\(\s*'%Y'\s*,\s*'now'\s*\)/gi,
    "EXTRACT(YEAR FROM NOW())::text"
  );

  // IFNULL → COALESCE
  translated = translated.replace(/IFNULL\s*\(/gi, 'COALESCE(');

  // DATE(col) → col::date  (but not CURRENT_DATE or UPDATE)
  translated = translated.replace(
    /\bDATE\s*\(\s*([a-zA-Z_][a-zA-Z0-9_.]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\s*\)/gi,
    '$1::date'
  );

  // PRAGMA table_info(tablename) → information_schema query
  const pragmaMatch = translated.match(/PRAGMA\s+table_info\s*\(\s*([a-zA-Z_]+)\s*\)/i);
  if (pragmaMatch) {
    const tableName = pragmaMatch[1];
    translated = `SELECT column_name as name, data_type as type, is_nullable, column_default as dflt_value FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`;
  }

  // Replace empty string comparison for PostgreSQL: != "" → != ''
  translated = translated.replace(/!= ""/g, "!= ''");
  translated = translated.replace(/= ""/g, "= ''");

  // Replace ? placeholders with $1, $2, $3 ...
  let paramIndex = 0;
  translated = translated.replace(/\?/g, () => `$${++paramIndex}`);

  // For INSERT OR IGNORE: append ON CONFLICT DO NOTHING after VALUES(...)
  if (wasInsertOrIgnore) {
    // Insert ON CONFLICT DO NOTHING before any RETURNING clause or at the end
    if (/RETURNING/i.test(translated)) {
      translated = translated.replace(/(RETURNING)/i, 'ON CONFLICT DO NOTHING $1');
    } else {
      translated = translated.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
    }
  }

  return translated;
}

// ──────────────────────────────────────────────
// Query helpers (same API as old connection.ts)
// ──────────────────────────────────────────────

/**
 * Execute a SELECT query, returns array of rows.
 * Accepts SQLite-style ? placeholders — they are auto-translated to $1, $2 ...
 */
export const query = async (sql: string, params: any[] = []): Promise<any[]> => {
  const translated = translateSQL(sql);
  const result = await pool.query(translated, params);
  return result.rows;
};

/**
 * Execute an INSERT/UPDATE/DELETE, returns { lastInsertRowid, changes }.
 * For INSERTs, automatically appends RETURNING id to get the new row ID.
 */
export const run = async (sql: string, params: any[] = []): Promise<{ lastInsertRowid: number; changes: number }> => {
  let translated = translateSQL(sql);

  // For INSERT statements, append RETURNING id to get the inserted ID
  const isInsert = /^\s*INSERT\s/i.test(translated);
  if (isInsert && !/RETURNING/i.test(translated)) {
    // Handle ON CONFLICT — append RETURNING after the conflict clause
    if (/ON\s+CONFLICT/i.test(translated)) {
      translated = translated.replace(/(ON\s+CONFLICT[^;]*)$/i, '$1 RETURNING id');
    } else {
      translated = translated.replace(/;?\s*$/, ' RETURNING id');
    }
  }

  const result = await pool.query(translated, params);
  return {
    lastInsertRowid: result.rows?.[0]?.id ?? 0,
    changes: result.rowCount ?? 0
  };
};

/**
 * Execute a query that returns a single row (or null).
 */
export const get = async (sql: string, params: any[] = []): Promise<any> => {
  const translated = translateSQL(sql);
  const result = await pool.query(translated, params);
  return result.rows[0] || null;
};

// ──────────────────────────────────────────────
// Compatibility layer for direct db usage
// (used by registrar.controller.ts and courses.controller.ts)
// ──────────────────────────────────────────────

const db = {
  /**
   * Compatibility wrapper for `db.prepare(sql).all(params)`
   * Returns an object with .all(), .get(), .run() methods
   */
  prepare(sql: string) {
    const translated = translateSQL(sql);
    return {
      all: async (...args: any[]) => {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const result = await pool.query(translated, params);
        return result.rows;
      },
      get: async (...args: any[]) => {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const result = await pool.query(translated, params);
        return result.rows[0] || null;
      },
      run: async (...args: any[]) => {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        let finalSql = translated;
        // Add RETURNING id for INSERT statements
        if (/^\s*INSERT\s/i.test(finalSql) && !/RETURNING/i.test(finalSql)) {
          finalSql = finalSql.replace(/;?\s*$/, ' RETURNING id');
        }
        const result = await pool.query(finalSql, params);
        return {
          lastInsertRowid: result.rows?.[0]?.id ?? 0,
          changes: result.rowCount ?? 0
        };
      }
    };
  },

  /**
   * Compatibility wrapper for db.exec(sql) — runs raw SQL
   */
  async exec(sql: string) {
    const translated = translateSQL(sql);
    await pool.query(translated);
  },

  /**
   * Compatibility wrapper for db.transaction(fn)
   * Wraps the function in a PostgreSQL transaction
   */
  transaction(fn: (items: any[]) => void) {
    return async (items: any[]) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await fn(items);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    };
  },

  /**
   * Compatibility wrapper for db.pragma() — no-op on PostgreSQL
   */
  pragma(_statement: string) {
    // PRAGMA is SQLite-specific, no-op on PostgreSQL
    return [];
  },

  /**
   * Close the pool
   */
  async close() {
    await pool.end();
  }
};

export { pool };
export default db;
