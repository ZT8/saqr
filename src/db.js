'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS indicators (
      id INTEGER PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('url','phone','message')),
      value TEXT NOT NULL,              -- normalised key (E.164 phone, host+path URL, or message fingerprint)
      category TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
      report_count INTEGER NOT NULL DEFAULT 0,
      risk_score INTEGER,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      reviewed_at TEXT,
      UNIQUE (type, value)
    );
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY,
      indicator_id INTEGER NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      channel TEXT NOT NULL,
      emirate TEXT,
      content TEXT,                     -- victim PII already redacted
      amount_lost REAL,
      reporter_hash TEXT NOT NULL,      -- HMAC(ip + day), rotates daily, not reversible
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS report_indicators (   -- one report can touch several indicators (message + its links/numbers)
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      indicator_id INTEGER NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
      PRIMARY KEY (report_id, indicator_id)
    );
    CREATE TABLE IF NOT EXISTS scan_stats (   -- aggregate counters only; scanned content is never stored
      day TEXT NOT NULL, type TEXT NOT NULL, level TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, type, level)
    );
    CREATE TABLE IF NOT EXISTS learned_samples (
      id INTEGER PRIMARY KEY, text TEXT NOT NULL, label TEXT NOT NULL, source_indicator INTEGER, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY, admin TEXT NOT NULL, action TEXT NOT NULL, target TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
    CREATE INDEX IF NOT EXISTS idx_reports_indicator ON reports(indicator_id);
    CREATE INDEX IF NOT EXISTS idx_indicators_status ON indicators(status);
  `);
  return db;
}

module.exports = { openDb };
