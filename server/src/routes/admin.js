// Platform admin (role: admin) + public merchant sign-up ("انضم لـ Around").
const express = require('express');
const db = require('../db');
const { h, fail, auth, requireRole, notify, realtime } = require('../services/core');
const { normalizePhone } = require('./auth');
const orders = require('../services/orders');
const { CATEGORIES } = require('./stores');

// ---------- public: join ----------
// The website only collects an application. No account exists until an admin approves it; sign-in happens in the app.
const join = express.Router();
const joinLog = new Map(); // phone -> last submit time (cheap spam guard)
join.post('/', h((req, res) => {
  const b = req.body || {};
  const phone = normalizePhone(b.phone);
  if (!phone) fail(400, 'رقم الهاتف غير صحيح');
  const name = String(b.business_name || '').trim().slice(0, 60);
  const contact = String(b.contact_name || '').trim().slice(0, 40);
  const city = String(b.city || '').trim().slice(0, 30);
  const area = String(b.area || '').trim().slice(0, 40);
  const note = String(b.note || '').trim().slice(0, 300);
  const branches = Math.min(50, Math.max(1, parseInt(b.branches, 10) || 1));
  if (!name || !contact || !city || !area) fail(400, 'كمّل كل الخانات');
  if (!CATEGORIES.some((c) => c.key === b.category)) fail(400, 'اختر نوع النشاط');
  if (db.one(`SELECT 1 FROM merchant_applications WHERE phone = ? AND status = 'new'`, phone)) fail(409, 'عندنا طلب سابق بنفس الرقم، بنتواصل معك قريب');
  if (Date.now() - (joinLog.get(phone) || 0) < 10000) fail(429, 'جرّب بعد شوي');
  joinLog.set(phone, Date.now());
  const id = db.run(`INSERT INTO merchant_applications (business_name, category, contact_name, phone, city, area, branches, note) VALUES (?,?,?,?,?,?,?,?)`,
    name, b.category, contact, phone, city, area, branches, note).lastInsertRowid;
  realtime.toAdmin('merchant:applied', { id });
  res.status(201).json({ ok: true });
}));

// ---------- admin ----------
const r = express.Router();
r.use(auth, requireRole('admin'));

r.get('/overview', h((_req, res) => {
  const t = db.one(`SELECT COUNT(*) orders, COALESCE(SUM(subtotal - reward_discount),0) gmv, COALESCE(SUM(commission),0) revenue
    FROM orders WHERE status = 'delivered' AND date(created_at) = date('now')`);
  const m = db.one(`SELECT COUNT(*) total, SUM(status='active') active, (SELECT COUNT(*) FROM merchant_applications WHERE status = 'new') pending FROM merchants`);
  const u = db.one(`SELECT COUNT(*) n FROM users WHERE role = 'customer'`).n;
  const live = db.one(`SELECT COUNT(*) n FROM orders WHERE status IN ('new','preparing','ready')`).n;
  const reports = db.one(`SELECT COUNT(*) n FROM reports WHERE status = 'open'`).n;
  const days = db.all(`SELECT date(created_at) d, COUNT(*) orders, SUM(subtotal - reward_discount) gmv, SUM(commission) revenue FROM orders
    WHERE status = 'delivered' AND created_at >= date('now','-13 days') GROUP BY d ORDER BY d`);
  res.json({ today: t, merchants: m, customers: u, live, open_reports: reports, days });
}));

r.get('/merchants', h((req, res) => {
  const rows = db.all(`SELECT m.*, (SELECT COUNT(*) FROM branches WHERE merchant_id = m.id) branches,
      (SELECT COUNT(*) FROM orders WHERE merchant_id = m.id AND status = 'delivered') delivered,
      (SELECT COALESCE(SUM(commission),0) FROM orders WHERE merchant_id = m.id AND status = 'delivered') revenue,
      (SELECT phone FROM users WHERE merchant_id = m.id AND role = 'merchant' LIMIT 1) owner_phone,
      (SELECT name FROM users WHERE merchant_id = m.id AND role = 'merchant' LIMIT 1) owner_name
    FROM merchants m ORDER BY (m.status = 'pending') DESC, m.id DESC`);
  res.json(rows.map((m) => ({ ...m, tags: JSON.parse(m.tags || '[]') })));
}));

r.patch('/merchants/:id', h((req, res) => {
  const m = db.one('SELECT * FROM merchants WHERE id = ?', req.params.id);
  if (!m) fail(404, 'التاجر غير موجود');
  const status = ['pending', 'active', 'suspended'].includes(req.body.status) ? req.body.status : m.status;
  const pct = req.body.commission_pct != null ? Number(req.body.commission_pct) : m.commission_pct;
  if (!(pct >= 0 && pct <= 50)) fail(400, 'العمولة بين 0 و 50%');
  db.run('UPDATE merchants SET status = ?, commission_pct = ? WHERE id = ?', status, pct, m.id);
  if (status === 'active' && m.status === 'pending') {
    const owner = db.one(`SELECT id FROM users WHERE merchant_id = ? AND role = 'merchant'`, m.id);
    if (owner) notify(owner.id, 'تم اعتماد محلك في Around', 'تقدر الحين تضيف المنيو وتبدأ تستقبل الطلبات', '/merchant');
  }
  res.json(db.one('SELECT * FROM merchants WHERE id = ?', m.id));
}));

r.post('/merchants', h((req, res) => {
  const b = req.body;
  const phone = normalizePhone(b.owner_phone);
  if (!phone) fail(400, 'رقم هاتف المالك غير صحيح');
  if (!b.name || !CATEGORIES.some((c) => c.key === b.category)) fail(400, 'كمّل الاسم ونوع النشاط');
  const existing = db.one('SELECT * FROM users WHERE phone = ?', phone);
  if (existing && existing.role !== 'customer') fail(409, 'الرقم مسجل كحساب تجاري');
  const id = db.tx(() => {
    const mid = db.run(`INSERT INTO merchants (name, category, status, commission_pct) VALUES (?,?, 'active', ?)`, String(b.name).trim(), b.category, Number(b.commission_pct) || 7).lastInsertRowid;
    if (existing) db.run(`UPDATE users SET role = 'merchant', merchant_id = ? WHERE id = ?`, mid, existing.id);
    else db.run(`INSERT INTO users (phone, name, role, merchant_id) VALUES (?,?,'merchant',?)`, phone, b.owner_name || 'المالك', mid);
    return mid;
  });
  res.status(201).json({ id });
}));

r.get('/applications', h((_req, res) => {
  res.json(db.all(`SELECT * FROM merchant_applications WHERE status = 'new' ORDER BY id DESC`));
}));

r.post('/applications/:id/approve', h((req, res) => {
  const a = db.one(`SELECT * FROM merchant_applications WHERE id = ? AND status = 'new'`, req.params.id);
  if (!a) fail(404, 'الطلب غير موجود أو تمت معالجته');
  const pct = req.body.commission_pct != null ? Number(req.body.commission_pct) : 7;
  if (!(pct >= 0 && pct <= 50)) fail(400, 'العمولة بين 0 و 50%');
  const existing = db.one('SELECT * FROM users WHERE phone = ?', a.phone);
  if (existing && existing.role !== 'customer') fail(409, 'هذا الرقم مسجل كحساب تجاري');
  const mid = db.tx(() => {
    const id = db.run(`INSERT INTO merchants (name, category, status, commission_pct) VALUES (?,?, 'active', ?)`, a.business_name, a.category, pct).lastInsertRowid;
    db.run('INSERT INTO branches (merchant_id, name, area, city, lat, lng) VALUES (?,?,?,?,?,?)', id, a.area, a.area, a.city, 24.2075, 55.7447);
    if (existing) db.run(`UPDATE users SET role = 'merchant', merchant_id = ? WHERE id = ?`, id, existing.id);
    else db.run(`INSERT INTO users (phone, name, role, merchant_id) VALUES (?,?,'merchant',?)`, a.phone, a.contact_name, id);
    db.run(`UPDATE merchant_applications SET status = 'approved', merchant_id = ? WHERE id = ?`, id, a.id);
    return id;
  });
  res.json({ merchant_id: mid });
}));

r.post('/applications/:id/reject', h((req, res) => {
  const n = db.run(`UPDATE merchant_applications SET status = 'rejected' WHERE id = ? AND status = 'new'`, req.params.id).changes;
  if (!n) fail(404, 'الطلب غير موجود أو تمت معالجته');
  res.json({ ok: true });
}));

const banners = require('../services/banners');
r.use('/banners/own', banners.manager({ ownerOf: () => null, statusOnCreate: 'active' }));
// Merchant banners waiting for review, and the decision.
r.get('/banners/review', h((_req, res) => res.json(db.all(`SELECT b.*, m.name owner_name FROM banners b JOIN merchants m ON m.id = b.owner_merchant_id
  WHERE b.status = 'pending' ORDER BY b.id`))));
r.post('/banners/:id/:action(approve|reject)', h((req, res) => {
  const b = db.one('SELECT * FROM banners WHERE id = ? AND owner_merchant_id IS NOT NULL', req.params.id);
  if (!b) fail(404, 'البنر غير موجود');
  db.run('UPDATE banners SET status = ? WHERE id = ?', req.params.action === 'approve' ? 'active' : 'rejected', b.id);
  res.json({ ok: true });
}));
r.get('/orders', h((req, res) => {
  const rows = req.query.live
    ? db.all(`SELECT * FROM orders WHERE status IN ('new','preparing','ready') ORDER BY id DESC`)
    : db.all(`SELECT * FROM orders WHERE status != 'pending_payment' ORDER BY id DESC LIMIT 200`);
  res.json(rows.map(orders.serialize));
}));

r.get('/users', h((req, res) => {
  const q = '%' + String(req.query.q || '') + '%';
  res.json(db.all(`SELECT u.id, u.name, u.username, u.phone, u.role, u.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status = 'delivered') orders
    FROM users u WHERE u.phone LIKE ? OR u.name LIKE ? OR u.username LIKE ? ORDER BY u.id DESC LIMIT 200`, q, q, q));
}));

r.get('/reports', h((_req, res) => {
  const rows = db.all(`SELECT r.*, p.image, p.caption, p.removed, u.name reporter, au.name author, au.id author_id,
      (SELECT COUNT(*) FROM reports x WHERE x.post_id = r.post_id AND x.status = 'open') count
    FROM reports r JOIN posts p ON p.id = r.post_id JOIN users u ON u.id = r.user_id JOIN users au ON au.id = p.user_id
    WHERE r.status = 'open' GROUP BY r.post_id ORDER BY count DESC, r.id`);
  res.json(rows);
}));

r.post('/reports/:postId/:action', h((req, res) => {
  const { postId, action } = req.params;
  if (!['remove', 'dismiss'].includes(action)) fail(400, 'إجراء غير معروف');
  db.tx(() => {
    if (action === 'remove') {
      db.run('UPDATE posts SET removed = 1 WHERE id = ?', postId);
      const p = db.one('SELECT user_id FROM posts WHERE id = ?', postId);
      if (p) notify(p.user_id, 'تم حذف منشورك', 'لأنه خالف إرشادات المحتوى في Around');
    }
    db.run(`UPDATE reports SET status = ? WHERE post_id = ? AND status = 'open'`, action === 'remove' ? 'removed' : 'dismissed', postId);
  });
  res.json({ ok: true });
}));

module.exports = { admin: r, join };
