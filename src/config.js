'use strict';
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Minimal .env loader (no extra dependency).
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'saqr.db'),
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'saqr-demo-2026',
  // Secret used to hash reporter fingerprints. Random per run if not set (stronger privacy, no cross-restart linking).
  hashSecret: process.env.HASH_SECRET || crypto.randomBytes(32).toString('hex'),
  demoData: process.env.DEMO_DATA !== 'false',
  sessionHours: Number(process.env.SESSION_HOURS || 8),
  // A pending indicator is shown (masked) in the public registry after this many independent reports.
  publicThreshold: Number(process.env.PUBLIC_THRESHOLD || 3),
  // Evidence vault: encrypted files live here. Key: EVIDENCE_KEY (64 hex chars) or generated once into data/evidence.key
  evidenceDir: process.env.EVIDENCE_DIR || path.join(__dirname, '..', 'data', 'evidence'),
  evidenceKey: process.env.EVIDENCE_KEY || '',
  publicUrl: process.env.PUBLIC_URL || '',
};
