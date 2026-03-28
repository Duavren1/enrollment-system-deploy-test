/**
 * Utility for parsing UTC timestamps from SQLite database.
 *
 * SQLite's datetime('now') stores timestamps in UTC like "2026-03-28 10:30:00"
 * WITHOUT a timezone indicator. JavaScript's new Date("2026-03-28 10:30:00")
 * incorrectly treats such strings as local time. This function appends 'Z'
 * so the browser correctly interprets the value as UTC and converts to the
 * user's local timezone for display.
 */

export function parseUTCDate(timestamp: string | null | undefined): Date {
  if (!timestamp) return new Date();

  const ts = timestamp.trim();

  // Already has timezone info — parse as-is
  if (ts.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(ts)) {
    return new Date(ts);
  }

  // SQLite datetime format: "YYYY-MM-DD HH:MM:SS" → append 'Z' to mark UTC
  if (ts.includes(' ') && !ts.includes('T')) {
    return new Date(ts.replace(' ', 'T') + 'Z');
  }

  // ISO-ish format with 'T' but no timezone — treat as UTC
  if (ts.includes('T')) {
    return new Date(ts + 'Z');
  }

  // Date-only string (e.g. "2026-03-28") — parse as-is (JS treats as UTC midnight)
  return new Date(ts);
}
