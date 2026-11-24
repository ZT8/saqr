// Shared services: auth tokens, errors, realtime, notifications, geo, money, tiers.
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-only-change-me') throw new Error('Set JWT_SECRET in production');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

// ---------- auth ----------
function signToken(user) {
  return jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '30d' });
}
function userFromToken(token) {
  try {
    const { uid } = jwt.verify(token, JWT_SECRET);
    return db.one('SELECT * FROM users WHERE id = ?', uid) || null;
  } catch { return null; }
}
function auth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  req.user = token ? userFromToken(token) : null;
  if (!req.user) return next(new HttpError(401, 'سجّل دخولك أولاً'));
  next();
}
function optionalAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  req.user = h.startsWith('Bearer ') ? userFromToken(h.slice(7)) : null;
  next();
}
const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'ما عندك صلاحية'));

// Wrap async/sync route handlers so thrown errors reach the error middleware.
const h = (fn) => (req, res, next) => {
  try { const r = fn(req, res, next); if (r && r.catch) r.catch(next); } catch (e) { next(e); }
};

// ---------- realtime ----------
let io = null;
const realtime = {
  attach(server) { io = server; },
  toUser(id, ev, data) { io && io.to('user:' + id).emit(ev, data); },
  toBranch(id, ev, data) { io && io.to('branch:' + id).emit(ev, data); },
  toMerchant(id, ev, data) { io && io.to('merchant:' + id).emit(ev, data); },
  toAdmin(ev, data) { io && io.to('admin').emit(ev, data); }
};

function notify(userId, title, body = '', link = null) {
  const r = db.run('INSERT INTO notifications (user_id, title, body, link) VALUES (?,?,?,?)', userId, title, body, link);
  realtime.toUser(userId, 'notification', { id: r.lastInsertRowid, title, body, link });
}

// ---------- geo ----------
function distanceMeters(a, b) {
  const R = 6371000, rad = (d) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}
const GEOFENCE_M = Number(process.env.GEOFENCE_M || 80);
// Urban driving estimate: ~30 km/h average => 500 m per minute, at least 1 minute.
const etaMinutes = (m) => Math.max(1, Math.round(m / 500));

// ---------- money ----------
const aed = (fils) => (fils / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, '') + '\u00A0د.إ';

// ---------- membership tiers (platform-level) ----------
// Based on delivered orders in the current calendar year; valid until end of next year.
const TIERS = [
  { key: 'bronze', name: 'البرونزية', min: 0 },
  { key: 'silver', name: 'الفضية', min: 10 },
  { key: 'gold', name: 'الذهبية', min: 30 },
  { key: 'platinum', name: 'البلاتينية', min: 60 }
];
function tierFor(userId) {
  const year = new Date().getFullYear();
  const { n } = db.one(
    `SELECT COUNT(*) n FROM orders WHERE user_id = ? AND status = 'delivered' AND strftime('%Y', created_at) = ?`,
    userId, String(year)
  );
  let idx = 0;
  TIERS.forEach((t, i) => { if (n >= t.min) idx = i; });
  const cur = TIERS[idx], next = TIERS[idx + 1] || null;
  return {
    key: cur.key, name: cur.name, orders: n,
    next: next ? { key: next.key, name: next.name, remaining: next.min - n } : null,
    progress: next ? Math.round(((n - cur.min) / (next.min - cur.min)) * 100) : 100,
    valid_until: `${year + 1}-12-31`
  };
}

module.exports = {
  HttpError, fail, signToken, userFromToken, auth, optionalAuth, requireRole, h,
  realtime, notify, distanceMeters, etaMinutes, GEOFENCE_M, aed, tierFor, TIERS
};
