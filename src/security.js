'use strict';
const crypto = require('crypto');

/** Simple in-memory sliding-window rate limiter. */
function rateLimit({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map();
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, arr] of hits) {
      const kept = arr.filter((t) => t > cutoff);
      if (kept.length) hits.set(k, kept); else hits.delete(k);
    }
  }, windowMs).unref();
  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    const arr = (hits.get(k) || []).filter((t) => t > now - windowMs);
    if (arr.length >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'rate_limited' });
    }
    arr.push(now);
    hits.set(k, arr);
    next();
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return h.length === expected.length && crypto.timingSafeEqual(h, expected);
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

/** In-memory admin sessions (opaque random tokens, httpOnly cookie). */
function sessionStore(hours) {
  const sessions = new Map();
  return {
    create(user) {
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { user, exp: Date.now() + hours * 3600e3 });
      return token;
    },
    get(token) {
      const s = token && sessions.get(token);
      if (!s) return null;
      if (s.exp < Date.now()) { sessions.delete(token); return null; }
      return s;
    },
    destroy(token) { sessions.delete(token); },
  };
}

module.exports = { rateLimit, hashPassword, verifyPassword, parseCookies, sessionStore };
