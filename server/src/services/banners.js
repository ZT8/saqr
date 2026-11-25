// Home-screen banners: Around's own + merchants' (merchant banners need admin approval).
const db = require('../db');
const { h, fail, auth } = require('./core');
const { upload, fileUrl } = require('./uploads');
const express = require('express');

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function live() {
  return db.all(`SELECT b.*, m.name owner_name, l.name link_name FROM banners b
    LEFT JOIN merchants m ON m.id = b.owner_merchant_id LEFT JOIN merchants l ON l.id = b.link_merchant_id
    WHERE b.status = 'active' AND b.is_active = 1 AND b.image IS NOT NULL
      AND (b.starts_at IS NULL OR b.starts_at <= date('now')) AND (b.ends_at IS NULL OR b.ends_at >= date('now'))
      AND (l.id IS NULL OR l.status = 'active')
    ORDER BY b.sort, b.id DESC LIMIT 8`).map(pub);
}
const pub = (b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, image: b.image, merchant_id: b.link_merchant_id, merchant_name: b.link_name });

function fields(body, base = {}) {
  const f = {
    title: String(body.title ?? base.title ?? '').trim().slice(0, 60),
    subtitle: String(body.subtitle ?? base.subtitle ?? '').trim().slice(0, 100),
    starts_at: body.starts_at !== undefined ? (body.starts_at || null) : (base.starts_at ?? null),
    ends_at: body.ends_at !== undefined ? (body.ends_at || null) : (base.ends_at ?? null),
    sort: Math.round(Number(body.sort ?? base.sort ?? 0)) || 0,
    is_active: body.is_active !== undefined ? (String(body.is_active) === '0' || body.is_active === false ? 0 : 1) : (base.is_active ?? 1),
    link_merchant_id: body.link_merchant_id !== undefined ? (Number(body.link_merchant_id) || null) : (base.link_merchant_id ?? null)
  };
  for (const k of ['starts_at', 'ends_at']) if (f[k] && !DATE.test(f[k])) fail(400, 'التاريخ غير صحيح');
  if (f.starts_at && f.ends_at && f.ends_at < f.starts_at) fail(400, 'تاريخ النهاية قبل البداية');
  return f;
}

// Mounted under /merchant and /admin with the owner decided by the caller.
function manager({ ownerOf, statusOnCreate, editable }) {
  const r = express.Router();
  const scope = (req) => { const o = ownerOf(req); return o == null ? ['b.owner_merchant_id IS NULL', []] : ['b.owner_merchant_id = ?', [o]]; };
  r.get('/', h((req, res) => {
    const [w, a] = scope(req);
    res.json(db.all(`SELECT b.*, l.name link_name FROM banners b LEFT JOIN merchants l ON l.id = b.link_merchant_id WHERE ${w} ORDER BY b.id DESC`, ...a));
  }));
  r.post('/', upload.single('image'), h((req, res) => {
    const f = fields(req.body);
    if (!req.file) fail(400, 'ارفع صورة البنر');
    if (!f.title) fail(400, 'اكتب عنوان البنر');
    const owner = ownerOf(req);
    if (owner != null) f.link_merchant_id = owner; // merchants can only link to themselves
    const id = db.run(`INSERT INTO banners (title, subtitle, image, owner_merchant_id, link_merchant_id, status, is_active, starts_at, ends_at, sort)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, f.title, f.subtitle, fileUrl(req.file), owner, f.link_merchant_id, statusOnCreate, f.is_active, f.starts_at, f.ends_at, f.sort).lastInsertRowid;
    res.status(201).json(db.one('SELECT * FROM banners WHERE id = ?', id));
  }));
  r.patch('/:id', upload.single('image'), h((req, res) => {
    const [w, a] = scope(req);
    const b = db.one(`SELECT b.* FROM banners b WHERE b.id = ? AND ${w}`, req.params.id, ...a);
    if (!b) fail(404, 'البنر غير موجود');
    const f = fields(req.body, b);
    if (ownerOf(req) != null) f.link_merchant_id = ownerOf(req);
    const changedLook = req.file || f.title !== b.title || f.subtitle !== b.subtitle;
    const status = ownerOf(req) != null && changedLook && b.status === 'active' ? 'pending' : b.status; // merchant edits need re-approval
    db.run('UPDATE banners SET title=?, subtitle=?, image=?, link_merchant_id=?, is_active=?, starts_at=?, ends_at=?, sort=?, status=? WHERE id = ?',
      f.title, f.subtitle, req.file ? fileUrl(req.file) : b.image, f.link_merchant_id, f.is_active, f.starts_at, f.ends_at, f.sort, status, b.id);
    res.json(db.one('SELECT * FROM banners WHERE id = ?', b.id));
  }));
  r.delete('/:id', h((req, res) => {
    const [w, a] = scope(req);
    const b = db.one(`SELECT b.id FROM banners b WHERE b.id = ? AND ${w}`, req.params.id, ...a);
    if (!b) fail(404, 'البنر غير موجود');
    db.run('DELETE FROM banners WHERE id = ?', b.id);
    res.json({ ok: true });
  }));
  return r;
}

// Public tracking (rate-limiting is a production concern; counters are advisory analytics).
const tracking = express.Router();
tracking.post('/:id/view', auth, h((req, res) => { db.run('UPDATE banners SET views = views + 1 WHERE id = ?', req.params.id); res.json({ ok: true }); }));
tracking.post('/:id/click', auth, h((req, res) => { db.run('UPDATE banners SET clicks = clicks + 1 WHERE id = ?', req.params.id); res.json({ ok: true }); }));
tracking.get('/', auth, h((_req, res) => res.json(live())));

module.exports = { live, manager, tracking };
