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

const production = process.env.NODE_ENV === 'production';
const DEMO_PASS = 'saqr-demo-2026';
const trust = process.env.TRUST_PROXY;

const config = {
  production,
  port: Number(process.env.PORT || 3000),
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'saqr.db'),
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || DEMO_PASS,
  // Secret used to hash reporter fingerprints. Random per run if not set (stronger privacy, no cross-restart linking).
  hashSecret: process.env.HASH_SECRET || crypto.randomBytes(32).toString('hex'),
  // Fictional demo data fills an empty database, except in production unless DEMO_DATA=true.
  demoData: process.env.DEMO_DATA ? process.env.DEMO_DATA !== 'false' : !production,
  sessionHours: Number(process.env.SESSION_HOURS || 8),
  // A pending indicator is shown (masked) in the public registry after this many independent reports.
  publicThreshold: Number(process.env.PUBLIC_THRESHOLD || 3),
  // Evidence vault: encrypted files live here. Key: EVIDENCE_KEY (64 hex chars) or generated once into data/evidence.key
  evidenceDir: process.env.EVIDENCE_DIR || path.join(__dirname, '..', 'data', 'evidence'),
  evidenceKey: process.env.EVIDENCE_KEY || '',
  publicUrl: process.env.PUBLIC_URL || '',
  // Threat feeds refresh interval in hours (0 = only when triggered from the dashboard or `npm run feeds:update`).
  feedRefreshHours: Number(process.env.FEED_REFRESH_HOURS ?? 12),
  // Session cookie gets the Secure flag in production or when served over https.
  secureCookies: production || /^https:/i.test(process.env.PUBLIC_URL || ''),
  // Express "trust proxy": a hop count ("1"), "true", or a list of addresses. Default: local proxy only.
  trustProxy: trust === undefined ? 'loopback' : /^\d+$/.test(trust) ? Number(trust) : trust === 'true' ? true : trust,
};

/** Refuses to run a production server with demo or missing secrets. Returns the problems found. */
config.productionProblems = () => {
  if (!production) return [];
  const p = [];
  if (!process.env.ADMIN_PASS || process.env.ADMIN_PASS === DEMO_PASS) p.push('ADMIN_PASS is missing or is the demo password');
  else if (process.env.ADMIN_PASS.length < 12) p.push('ADMIN_PASS must be at least 12 characters');
  if (!process.env.HASH_SECRET) p.push('HASH_SECRET is missing');
  if (!process.env.EVIDENCE_KEY) p.push('EVIDENCE_KEY is missing');
  return p;
};

module.exports = config;
