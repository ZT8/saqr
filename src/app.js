'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const { openDb } = require('./db');
const { Engine } = require('./engine');
const { makeServices, CATEGORIES, CHANNELS, EMIRATES } = require('./services');
const { rateLimit, hashPassword, verifyPassword, parseCookies, sessionStore } = require('./security');
const { makeVault } = require('./vault');
const { makeCases, PLATFORMS, DEMANDS } = require('./cases');
const { makeFamily } = require('./family');
const { makeCampaigns } = require('./campaigns');
const { makeTraining } = require('./training');
const { makeFeeds } = require('./feeds');
const { makeTerms } = require('./terms');
const QRCode = require('qrcode');

function createApp(config) {
  const db = openDb(config.dbPath);
  const engine = new Engine();
  const svc = makeServices(db, engine, config);
  svc.retrain();
  const cases = makeCases(db, makeVault(config));
  const family = makeFamily(db);
  const campaigns = makeCampaigns(db);
  const training = makeTraining(engine, svc.registry);
  const feeds = makeFeeds(db, { fetchImpl: config.fetchImpl });
  svc.setFeedLookup(feeds.lookup);
  const terms = makeTerms(db);

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
  // Evidence uploads (base64 JSON) get a larger body limit; everything else stays small.
  const bigJson = express.json({ limit: '40mb' });
  const smallJson = express.json({ limit: '20kb' });
  app.use((req, res, next) => (req.path.startsWith('/api/help/case') || req.path === '/api/admin/sources/upload' || req.path === '/api/admin/terms/import' ? bigJson : smallJson)(req, res, next));

  const wrap = (fn) => async (req, res) => {
    try {
      const out = await fn(req, res);
      if (out !== undefined) res.json(out);
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.code || e.message });
      console.error(e);
      res.status(500).json({ error: 'server_error' });
    }
  };

  // ---------- Public API ----------
  const api = express.Router();
  // Shared UI strings (the same dictionary the web app uses) for the mobile app.
  const i18nJson = (() => {
    try {
      const vm = require('vm');
      const ctx = { localStorage: undefined, document: undefined, console };
      vm.createContext(ctx);
      vm.runInContext(require('fs').readFileSync(path.join(__dirname, '..', 'public', 'js', 'i18n.js'), 'utf8') + ';globalThis.__I18N = I18N;', ctx);
      return JSON.stringify(ctx.__I18N);
    } catch (e) { console.error('[saqr] i18n export failed', e.message); return '{}'; }
  })();
  api.get('/i18n', (req, res) => res.type('json').set('Cache-Control', 'public, max-age=3600').send(i18nJson));
  api.get('/meta', (req, res) => res.json({ categories: CATEGORIES, channels: CHANNELS, emirates: EMIRATES, platforms: PLATFORMS, demands: DEMANDS }));
  api.get('/stats', wrap(() => svc.publicStats()));

  api.post('/scan', rateLimit({ windowMs: 60e3, max: 60 }), wrap((req) => {
    const { type = 'auto', value } = req.body || {};
    if (!['auto', 'message', 'url', 'phone'].includes(type)) throw new svc.ValidationError('invalid_type');
    if (typeof value !== 'string' || !value.trim()) throw new svc.ValidationError('empty_value');
    if (value.length > 5000) throw new svc.ValidationError('too_long');
    const result = svc.scan(type, value);
    // Elderly mode: risky results on a paired device alert the family guardian.
    const elder = req.get('X-Elder-Token');
    if (elder) result.familyAlerted = family.onElderScan(elder, result, { shareText: req.body.share === true, text: value });
    return result;
  }));

  // ----- Extortion help (anonymous, encrypted) -----
  api.post('/help/case', rateLimit({ windowMs: 60 * 60e3, max: 5 }), wrap((req, res) => {
    res.status(201);
    return cases.create(req.body || {});
  }));
  const caseLimit = rateLimit({ windowMs: 10 * 60e3, max: 20 });
  api.post('/help/case/status', caseLimit, wrap((req) => cases.status(req.body?.ref, req.body?.code)));
  api.post('/help/case/evidence', caseLimit, wrap((req) => cases.addEvidence(req.body?.ref, req.body?.code, req.body?.files)));
  api.post('/help/case/withdraw', caseLimit, wrap((req) => cases.withdraw(req.body?.ref, req.body?.code)));

  // ----- Family protection -----
  api.post('/family', rateLimit({ windowMs: 60 * 60e3, max: 10 }), wrap(async (req, res) => {
    const out = family.create(req.body?.label);
    const origin = config.publicUrl || `${req.protocol}://${req.get('host')}`;
    out.elderLink = `${origin}/elder#pair=${out.elderToken}`;
    out.qrSvg = await QRCode.toString(out.elderLink, { type: 'svg', margin: 1, color: { dark: '#12222d', light: '#ffffff' } });
    res.status(201);
    return out;
  }));
  const famLimit = rateLimit({ windowMs: 60e3, max: 30 });
  api.get('/family/alerts', famLimit, wrap((req) => family.alerts(req.get('X-Guardian-Token'))));
  api.post('/family/seen', famLimit, wrap((req) => family.markSeen(req.get('X-Guardian-Token'))));
  api.delete('/family', famLimit, wrap((req) => family.remove(req.get('X-Guardian-Token'))));
  api.get('/family/elder', famLimit, wrap((req) => family.elderInfo(req.get('X-Elder-Token'))));
  api.post('/family/help', famLimit, wrap((req) => family.help(req.get('X-Elder-Token'))));

  // ----- Awareness training -----
  api.get('/training', wrap((req) => training.questions(req.query.lang === 'en' ? 'en' : 'ar', 8)));

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
  admin.get('/campaigns', requireAdmin, wrap(() => campaigns.compute()));
  admin.post('/campaigns/verify', requireAdmin, wrap((req) => {
    const ids = Array.isArray(req.body?.indicatorIds) ? req.body.indicatorIds.map(Number).filter(Number.isInteger).slice(0, 200) : [];
    let learned = false, n = 0;
    for (const id of ids) {
      const row = db.prepare("SELECT status FROM indicators WHERE id = ?").get(id);
      if (!row || row.status !== 'pending') continue;
      learned = svc.setStatus(id, 'verified', req.admin).learned || learned;
      n++;
    }
    return { verified: n, model: learned ? svc.retrain() : undefined };
  }));
  admin.get('/cases', requireAdmin, wrap((req) => ({ counts: cases.counts(), items: cases.list({ status: String(req.query.status || '') }) })));
  admin.get('/cases/:id', requireAdmin, wrap((req) => cases.get(Number(req.params.id), req.admin)));
  admin.post('/cases/:id', requireAdmin, wrap((req) => cases.update(Number(req.params.id), { status: req.body?.status, note: req.body?.note }, req.admin)));
  admin.get('/cases/:id/evidence/:eid', requireAdmin, (req, res) => {
    try {
      const f = cases.evidenceFile(Number(req.params.id), Number(req.params.eid), req.admin);
      res.set({
        'Content-Type': f.mime,
        'Content-Disposition': `inline; filename="evidence-${req.params.eid}"`,
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
        'Cache-Control': 'no-store',
        'X-Evidence-SHA256': f.sha256,
        'X-Evidence-Integrity': f.intact ? 'ok' : 'mismatch',
      });
      res.send(f.buf);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.code || 'server_error' });
    }
  });
  // ----- Data sources: threat feeds, uploaded lists, scam phrases -----
  const audit = (admin, action, target) => db.prepare('INSERT INTO audit_log (admin, action, target, created_at) VALUES (?, ?, ?, ?)').run(admin, action, target || null, new Date().toISOString());
  admin.get('/sources', requireAdmin, wrap(() => ({ feeds: feeds.list(), terms: terms.list(), tactics: terms.tactics() })));
  admin.post('/sources/update-all', requireAdmin, wrap(async (req) => { audit(req.admin, 'feeds_update_all'); return { results: await feeds.updateAll() }; }));
  admin.post('/sources/upload', requireAdmin, wrap((req) => { const r = feeds.upload(req.body || {}); audit(req.admin, 'list_uploaded:' + req.body?.type, `${r.id} (${r.count})`); return r; }));
  admin.post('/sources/:id/update', requireAdmin, wrap(async (req) => { audit(req.admin, 'feed_update', req.params.id); return feeds.update(req.params.id); }));
  admin.post('/sources/:id/enabled', requireAdmin, wrap((req) => { audit(req.admin, 'feed_enabled:' + !!req.body?.enabled, req.params.id); return feeds.setEnabled(req.params.id, !!req.body?.enabled); }));
  admin.delete('/sources/:id', requireAdmin, wrap((req) => { audit(req.admin, 'feed_removed', req.params.id); return feeds.remove(req.params.id); }));
  admin.post('/terms', requireAdmin, wrap((req) => { const r = terms.add(req.body?.tactic, req.body?.term, req.admin); audit(req.admin, 'term_added:' + r.tactic, r.term); return r; }));
  admin.post('/terms/import', requireAdmin, wrap((req) => { const r = terms.importText(req.body?.text, req.admin, req.body?.tactic); audit(req.admin, 'terms_imported', `${r.added} added`); return r; }));
  admin.delete('/terms/:id', requireAdmin, wrap((req) => { audit(req.admin, 'term_removed', req.params.id); return terms.remove(Number(req.params.id)); }));
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
  app.use('/fonts/schibsted', express.static(path.join(__dirname, '..', 'node_modules', '@fontsource', 'schibsted-grotesk', 'files'), { maxAge: '30d' }));
  app.use('/fonts', express.static(path.join(__dirname, '..', 'node_modules', '@fontsource', 'ibm-plex-sans-arabic', 'files'), { maxAge: '30d' }));
  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

  return { app, db, engine, svc, cases, family, campaigns, feeds, terms };
}

module.exports = { createApp };
