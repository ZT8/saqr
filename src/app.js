'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { openDb } = require('./db');
const { Engine } = require('./engine');
const { makeServices, CATEGORIES, CHANNELS, EMIRATES } = require('./services');
const { rateLimit, hashPassword, verifyPassword, parseCookies, sessionStore } = require('./security');

function createApp(config) {
  const db = openDb(config.dbPath);
  const engine = new Engine();
  const svc = makeServices(db, engine, config);
  svc.retrain();

  // Ensure the admin account exists (credentials from env).
  if (!db.prepare('SELECT 1 FROM admins WHERE username = ?').get(config.adminUser)) {
    const { hash, salt } = hashPassword(config.adminPass);
    db.prepare('INSERT INTO admins (username, pass_hash, salt) VALUES (?, ?, ?)').run(config.adminUser, hash, salt);
  }

  const sessions = sessionStore(config.sessionHours);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(helmet({
    contentSecurityPolicy: { directives: { 'default-src': ["'self'"], 'img-src': ["'self'", 'data:'], 'style-src': ["'self'"], 'script-src': ["'self'"] } },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(express.json({ limit: '20kb' }));

  const wrap = (fn) => (req, res) => {
    try {
      const out = fn(req, res);
      if (out !== undefined) res.json(out);
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.code || e.message });
      console.error(e);
      res.status(500).json({ error: 'server_error' });
    }
  };

  // ---------- Public API ----------
  const api = express.Router();
  api.get('/meta', (req, res) => res.json({ categories: CATEGORIES, channels: CHANNELS, emirates: EMIRATES }));
  api.get('/stats', wrap(() => svc.publicStats()));

  api.post('/scan', rateLimit({ windowMs: 60e3, max: 60 }), wrap((req) => {
    const { type = 'auto', value } = req.body || {};
    if (!['auto', 'message', 'url', 'phone'].includes(type)) throw new svc.ValidationError('invalid_type');
    if (typeof value !== 'string' || !value.trim()) throw new svc.ValidationError('empty_value');
    if (value.length > 5000) throw new svc.ValidationError('too_long');
    return svc.scan(type, value);
  }));

  api.post('/report', rateLimit({ windowMs: 10 * 60e3, max: 10 }), wrap((req, res) => {
    const out = svc.createReport(req.body || {}, { ip: req.ip });
    res.status(201);
    return out;
  }));

  api.get('/registry', wrap((req) => svc.publicRegistry({
    q: String(req.query.q || '').slice(0, 200),
    type: String(req.query.type || ''),
    page: Math.max(1, parseInt(req.query.page, 10) || 1),
  })));

  // ---------- Authority API ----------
  const admin = express.Router();
  const requireAdmin = (req, res, next) => {
    const token = parseCookies(req.headers.cookie).saqr_session;
    const s = sessions.get(token);
    if (!s) return res.status(401).json({ error: 'unauthorized' });
    req.admin = s.user;
    req.sessionToken = token;
    next();
  };
  const cookie = (token, maxAge) =>
    `saqr_session=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}${config.secureCookies ? '; Secure' : ''}`;

  admin.post('/login', rateLimit({ windowMs: 60e3, max: 5 }), wrap((req, res) => {
    const { username, password } = req.body || {};
    const row = db.prepare('SELECT * FROM admins WHERE username = ?').get(String(username || ''));
    if (!row || !verifyPassword(String(password || ''), row.salt, row.pass_hash)) {
      res.status(401);
      return { error: 'invalid_credentials' };
    }
    const token = sessions.create(row.username);
    db.prepare('INSERT INTO audit_log (admin, action, created_at) VALUES (?, ?, ?)').run(row.username, 'login', new Date().toISOString());
    res.set('Set-Cookie', cookie(token, config.sessionHours * 3600));
    return { user: row.username };
  }));
  admin.post('/logout', requireAdmin, wrap((req, res) => {
    sessions.destroy(req.sessionToken);
    res.set('Set-Cookie', cookie('', 0));
    return { ok: true };
  }));
  admin.get('/me', requireAdmin, wrap((req) => ({ user: req.admin })));
  admin.get('/stats', requireAdmin, wrap(() => svc.adminStats(30)));
  admin.get('/indicators', requireAdmin, wrap((req) => svc.adminIndicators({
    status: String(req.query.status || 'pending'),
    type: String(req.query.type || ''),
    q: String(req.query.q || '').slice(0, 200),
    page: Math.max(1, parseInt(req.query.page, 10) || 1),
  })));
  admin.post('/indicators/:id/status', requireAdmin, wrap((req) => {
    const out = svc.setStatus(Number(req.params.id), String(req.body?.status), req.admin);
    if (out.learned) out.model = svc.retrain();
    return out;
  }));
  admin.get('/audit', requireAdmin, wrap(() => db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 50').all()));
  admin.get('/export.csv', requireAdmin, (req, res) => {
    const status = ['verified', 'pending', 'rejected'].includes(req.query.status) ? req.query.status : 'verified';
    db.prepare('INSERT INTO audit_log (admin, action, target, created_at) VALUES (?, ?, ?, ?)').run(req.admin, 'export_csv', status, new Date().toISOString());
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="saqr-${status}-indicators.csv"`);
    res.send('﻿' + svc.exportCsv(status));
  });

  app.use('/api', api);
  app.use('/api/admin', admin);
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

  // ---------- Static frontend ----------
  app.use('/fonts', express.static(path.join(__dirname, '..', 'node_modules', '@fontsource', 'ibm-plex-sans-arabic', 'files'), { maxAge: '30d' }));
  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

  return { app, db, engine, svc };
}

module.exports = { createApp };
