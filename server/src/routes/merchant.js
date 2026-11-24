// Merchant dashboard API (role: merchant).
const express = require('express');
const db = require('../db');
const { h, fail, auth, requireRole } = require('../services/core');
const { upload, fileUrl } = require('../services/uploads');
const { serializePosts } = require('../services/social');
const { normalizePhone } = require('./auth');
const orders = require('../services/orders');

const r = express.Router();
r.use(auth, requireRole('merchant'));
const M = (req) => req.user.merchant_id;

const fils = (v) => { const n = Math.round(Number(v) * 100); if (!(n > 0 && n < 1e7)) fail(400, 'السعر غير صحيح'); return n; };

// ---- profile ----
r.get('/profile', h((req, res) => {
  const m = db.one('SELECT * FROM merchants WHERE id = ?', M(req));
  res.json({ ...m, tags: JSON.parse(m.tags || '[]') });
}));
r.patch('/profile', h((req, res) => {
  const m = db.one('SELECT * FROM merchants WHERE id = ?', M(req));
  const name = String(req.body.name ?? m.name).trim().slice(0, 60);
  const tags = Array.isArray(req.body.tags) ? req.body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6) : JSON.parse(m.tags);
  const color = /^#[0-9a-fA-F]{6}$/.test(req.body.color || '') ? req.body.color : m.color;
  if (!name) fail(400, 'اكتب اسم المحل');
  db.run('UPDATE merchants SET name = ?, tags = ?, color = ? WHERE id = ?', name, JSON.stringify(tags), color, m.id);
  res.json({ ok: true });
}));
r.post('/profile/:field', upload.single('image'), h((req, res) => {
  if (!['logo', 'cover'].includes(req.params.field)) fail(400, 'حقل غير معروف');
  if (!req.file) fail(400, 'أرفق صورة');
  db.run(`UPDATE merchants SET ${req.params.field} = ? WHERE id = ?`, fileUrl(req.file), M(req));
  res.json({ url: fileUrl(req.file) });
}));

// ---- overview & reports ----
r.get('/overview', h((req, res) => {
  const id = M(req);
  const today = db.one(`SELECT COUNT(*) orders, COALESCE(SUM(subtotal - reward_discount),0) sales,
      COALESCE(AVG(CASE WHEN arrived_at IS NOT NULL THEN (julianday(delivered_at) - julianday(arrived_at)) * 1440 END),0) wait
    FROM orders WHERE merchant_id = ? AND status = 'delivered' AND date(created_at) = date('now')`, id);
  const rating = db.one(`SELECT AVG(rating) avg, COUNT(rating) n FROM orders WHERE merchant_id = ? AND rating IS NOT NULL AND created_at >= datetime('now','-30 days')`, id);
  const live = db.one(`SELECT COUNT(*) n FROM orders WHERE merchant_id = ? AND status IN ('new','preparing','ready')`, id).n;
  const days = db.all(`SELECT date(created_at) d, COUNT(*) orders, SUM(subtotal - reward_discount) sales FROM orders
    WHERE merchant_id = ? AND status = 'delivered' AND created_at >= date('now','-13 days') GROUP BY d ORDER BY d`, id);
  const top = db.all(`SELECT oi.name, SUM(oi.qty) qty FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.merchant_id = ? AND o.status = 'delivered' AND o.created_at >= datetime('now','-30 days') GROUP BY oi.name ORDER BY qty DESC LIMIT 5`, id);
  const recent = db.all(`SELECT * FROM orders WHERE merchant_id = ? AND status != 'pending_payment' ORDER BY id DESC LIMIT 8`, id).map(orders.serialize);
  res.json({ today: { orders: today.orders, sales: today.sales, avg_wait_min: Math.round(today.wait * 10) / 10 }, rating: { avg: rating.avg ? Math.round(rating.avg * 10) / 10 : null, count: rating.n }, live, days, top, recent });
}));

r.get('/orders', h((req, res) => {
  const status = req.query.status;
  const rows = status
    ? db.all('SELECT * FROM orders WHERE merchant_id = ? AND status = ? ORDER BY id DESC LIMIT 200', M(req), status)
    : db.all(`SELECT * FROM orders WHERE merchant_id = ? AND status != 'pending_payment' ORDER BY id DESC LIMIT 200`, M(req));
  res.json(rows.map(orders.serialize));
}));

// Settlement: what Around owes the merchant for delivered orders in a period.
r.get('/settlement', h((req, res) => {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : null;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : null;
  const f = from || db.one(`SELECT date('now','start of month') d`).d;
  const t = to || db.one(`SELECT date('now') d`).d;
  const s = db.one(`SELECT COUNT(*) orders, COALESCE(SUM(subtotal - reward_discount),0) gross, COALESCE(SUM(commission),0) commission
    FROM orders WHERE merchant_id = ? AND status = 'delivered' AND date(delivered_at) BETWEEN ? AND ?`, M(req), f, t);
  res.json({ from: f, to: t, ...s, net: s.gross - s.commission, commission_pct: db.one('SELECT commission_pct p FROM merchants WHERE id = ?', M(req)).p });
}));

// ---- menu ----
r.get('/menu', h((req, res) => {
  const cats = db.all('SELECT * FROM menu_categories WHERE merchant_id = ? ORDER BY sort, id', M(req));
  const items = db.all('SELECT * FROM menu_items WHERE merchant_id = ? ORDER BY id', M(req));
  res.json({ categories: cats, items });
}));
r.post('/categories', h((req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (!name) fail(400, 'اكتب اسم القسم');
  const sort = db.one('SELECT COALESCE(MAX(sort),0)+1 s FROM menu_categories WHERE merchant_id = ?', M(req)).s;
  res.status(201).json(db.one('SELECT * FROM menu_categories WHERE id = ?', db.run('INSERT INTO menu_categories (merchant_id, name, sort) VALUES (?,?,?)', M(req), name, sort).lastInsertRowid));
}));
r.delete('/categories/:id', h((req, res) => {
  db.run('DELETE FROM menu_categories WHERE id = ? AND merchant_id = ?', req.params.id, M(req));
  res.json({ ok: true });
}));

function itemFields(req, base = {}) {
  const b = req.body;
  const name = String(b.name ?? base.name ?? '').trim().slice(0, 60);
  if (!name) fail(400, 'اكتب اسم المنتج');
  const cat = b.category_id ?? base.category_id;
  if (cat && !db.one('SELECT 1 FROM menu_categories WHERE id = ? AND merchant_id = ?', cat, M(req))) fail(400, 'القسم غير صحيح');
  return {
    name, category_id: cat || null,
    description: String(b.description ?? base.description ?? '').slice(0, 200),
    price: b.price != null ? fils(b.price) : base.price,
    is_available: b.is_available != null ? (String(b.is_available) === '1' || b.is_available === true ? 1 : 0) : (base.is_available ?? 1),
    is_top: b.is_top != null ? (String(b.is_top) === '1' || b.is_top === true ? 1 : 0) : (base.is_top ?? 0)
  };
}
r.post('/items', upload.single('image'), h((req, res) => {
  const f = itemFields(req);
  if (!f.price) fail(400, 'اكتب السعر');
  const id = db.run('INSERT INTO menu_items (merchant_id, category_id, name, description, price, image, is_available, is_top) VALUES (?,?,?,?,?,?,?,?)',
    M(req), f.category_id, f.name, f.description, f.price, req.file ? fileUrl(req.file) : null, f.is_available, f.is_top).lastInsertRowid;
  res.status(201).json(db.one('SELECT * FROM menu_items WHERE id = ?', id));
}));
r.patch('/items/:id', upload.single('image'), h((req, res) => {
  const it = db.one('SELECT * FROM menu_items WHERE id = ? AND merchant_id = ?', req.params.id, M(req));
  if (!it) fail(404, 'المنتج غير موجود');
  const f = itemFields(req, it);
  db.run('UPDATE menu_items SET category_id = ?, name = ?, description = ?, price = ?, image = ?, is_available = ?, is_top = ? WHERE id = ?',
    f.category_id, f.name, f.description, f.price, req.file ? fileUrl(req.file) : it.image, f.is_available, f.is_top, it.id);
  res.json(db.one('SELECT * FROM menu_items WHERE id = ?', it.id));
}));
r.delete('/items/:id', h((req, res) => {
  const used = db.one('SELECT 1 FROM order_items WHERE item_id = ? LIMIT 1', req.params.id);
  if (used) db.run('UPDATE menu_items SET is_available = 0, category_id = NULL WHERE id = ? AND merchant_id = ?', req.params.id, M(req));
  else db.run('DELETE FROM menu_items WHERE id = ? AND merchant_id = ?', req.params.id, M(req));
  res.json({ ok: true, archived: !!used });
}));

// ---- branches ----
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
r.get('/branches', h((req, res) => res.json(db.all('SELECT * FROM branches WHERE merchant_id = ?', M(req)))));
function branchFields(b, base = {}) {
  const f = {
    name: String(b.name ?? base.name ?? '').trim(), area: String(b.area ?? base.area ?? '').trim(), city: String(b.city ?? base.city ?? '').trim(),
    lat: Number(b.lat ?? base.lat), lng: Number(b.lng ?? base.lng),
    open_time: b.open_time ?? base.open_time ?? '07:00', close_time: b.close_time ?? base.close_time ?? '23:00',
    prep_minutes: Math.round(Number(b.prep_minutes ?? base.prep_minutes ?? 10))
  };
  if (!f.name || !f.area || !f.city) fail(400, 'كمّل اسم الفرع والمنطقة والمدينة');
  if (!(Math.abs(f.lat) <= 90 && Math.abs(f.lng) <= 180) || !f.lat) fail(400, 'حدد موقع الفرع');
  if (!TIME.test(f.open_time) || !TIME.test(f.close_time)) fail(400, 'أوقات العمل غير صحيحة');
  if (!(f.prep_minutes >= 1 && f.prep_minutes <= 120)) fail(400, 'وقت التحضير غير صحيح');
  return f;
}
r.post('/branches', h((req, res) => {
  const f = branchFields(req.body);
  const id = db.run('INSERT INTO branches (merchant_id, name, area, city, lat, lng, open_time, close_time, prep_minutes) VALUES (?,?,?,?,?,?,?,?,?)',
    M(req), f.name, f.area, f.city, f.lat, f.lng, f.open_time, f.close_time, f.prep_minutes).lastInsertRowid;
  res.status(201).json(db.one('SELECT * FROM branches WHERE id = ?', id));
}));
r.patch('/branches/:id', h((req, res) => {
  const b = db.one('SELECT * FROM branches WHERE id = ? AND merchant_id = ?', req.params.id, M(req));
  if (!b) fail(404, 'الفرع غير موجود');
  const f = branchFields(req.body, b);
  db.run('UPDATE branches SET name=?, area=?, city=?, lat=?, lng=?, open_time=?, close_time=?, prep_minutes=? WHERE id = ?',
    f.name, f.area, f.city, f.lat, f.lng, f.open_time, f.close_time, f.prep_minutes, b.id);
  res.json(db.one('SELECT * FROM branches WHERE id = ?', b.id));
}));

// ---- staff ----
r.get('/staff', h((req, res) => {
  res.json(db.all(`SELECT u.id, u.name, u.phone, u.branch_id, b.name branch_name FROM users u LEFT JOIN branches b ON b.id = u.branch_id
    WHERE u.role = 'staff' AND u.merchant_id = ?`, M(req)));
}));
r.post('/staff', h((req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) fail(400, 'رقم الهاتف غير صحيح');
  const b = db.one('SELECT * FROM branches WHERE id = ? AND merchant_id = ?', req.body.branch_id, M(req));
  if (!b) fail(400, 'اختر الفرع');
  const name = String(req.body.name || '').trim() || 'موظف';
  const u = db.one('SELECT * FROM users WHERE phone = ?', phone);
  if (u && u.role !== 'customer' && u.merchant_id !== M(req)) fail(409, 'هذا الرقم مسجل كحساب تجاري ثاني');
  if (u) db.run(`UPDATE users SET role = 'staff', merchant_id = ?, branch_id = ?, name = COALESCE(name, ?) WHERE id = ?`, M(req), b.id, name, u.id);
  else db.run(`INSERT INTO users (phone, name, role, merchant_id, branch_id) VALUES (?,?,'staff',?,?)`, phone, name, M(req), b.id);
  res.status(201).json({ ok: true });
}));
r.delete('/staff/:id', h((req, res) => {
  db.run(`UPDATE users SET role = 'customer', merchant_id = NULL, branch_id = NULL WHERE id = ? AND merchant_id = ? AND role = 'staff'`, req.params.id, M(req));
  res.json({ ok: true });
}));

// ---- loyalty program ----
r.get('/loyalty', h((req, res) => {
  const p = db.one('SELECT * FROM loyalty_programs WHERE merchant_id = ?', M(req)) ||
    { merchant_id: M(req), active: 0, type: 'stamps', goal: 10, reward_text: 'المشروب العاشر مجاني', reward_value: 0, expiry_months: 6 };
  const stats = db.one(`SELECT COUNT(*) members, COALESCE(SUM(CASE WHEN balance >= ? THEN 1 ELSE 0 END),0) ready FROM loyalty_accounts WHERE merchant_id = ? AND balance > 0`, p.goal, M(req));
  const redeemed = db.one(`SELECT COUNT(*) n FROM loyalty_events WHERE merchant_id = ? AND reason = 'redeem' AND created_at >= datetime('now','-30 days')`, M(req)).n;
  res.json({ ...p, stats: { ...stats, redeemed_30d: redeemed } });
}));
r.put('/loyalty', h((req, res) => {
  const b = req.body;
  const type = b.type === 'points' ? 'points' : 'stamps';
  const goal = Math.round(Number(b.goal));
  if (!(goal >= 2 && goal <= 100000)) fail(400, 'الهدف غير صحيح');
  const reward = String(b.reward_text || '').trim().slice(0, 80);
  if (!reward) fail(400, 'اكتب المكافأة');
  const value = b.reward_value ? Math.round(Number(b.reward_value) * 100) : 0;
  if (!(value >= 0 && value <= 100000)) fail(400, 'قيمة المكافأة غير صحيحة');
  const exp = [0, 3, 6, 12].includes(Number(b.expiry_months)) ? Number(b.expiry_months) : 6;
  db.run(`INSERT INTO loyalty_programs (merchant_id, active, type, goal, reward_text, reward_value, expiry_months) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(merchant_id) DO UPDATE SET active=excluded.active, type=excluded.type, goal=excluded.goal, reward_text=excluded.reward_text,
    reward_value=excluded.reward_value, expiry_months=excluded.expiry_months`, M(req), b.active ? 1 : 0, type, goal, reward, value, exp);
  res.json(db.one('SELECT * FROM loyalty_programs WHERE merchant_id = ?', M(req)));
}));

// ---- stories about the store ----
r.get('/stories', h((req, res) => {
  const rows = db.all('SELECT * FROM posts WHERE merchant_id = ? AND removed = 0 AND attach_order = 1 ORDER BY pinned DESC, id DESC LIMIT 60', M(req));
  const out = serializePosts(rows, req.user.id).map((p) => ({
    ...p, orders_from: db.one(`SELECT COUNT(*) n FROM orders WHERE source_post_id = ? AND status = 'delivered'`, p.id).n
  }));
  res.json(out);
}));
r.post('/stories/:id/pin', h((req, res) => {
  const p = db.one('SELECT * FROM posts WHERE id = ? AND merchant_id = ?', req.params.id, M(req));
  if (!p) fail(404, 'غير موجود');
  db.run('UPDATE posts SET pinned = ? WHERE id = ?', p.pinned ? 0 : 1, p.id);
  res.json({ pinned: !p.pinned });
}));

module.exports = r;
