// Branch app (staff tablet): live board, order actions, open/close, item availability.
const express = require('express');
const db = require('../db');
const { h, fail, auth, requireRole } = require('../services/core');
const orders = require('../services/orders');
const { branchView } = require('../services/stores');

const r = express.Router();
r.use(auth, requireRole('staff', 'merchant'));

// Staff are bound to one branch; merchant owners can open any of their branches.
function branchFor(req) {
  const id = req.user.role === 'staff' ? req.user.branch_id : Number(req.query.branch_id || req.body.branch_id) ||
    (db.one('SELECT id FROM branches WHERE merchant_id = ? ORDER BY id LIMIT 1', req.user.merchant_id) || {}).id;
  const b = db.one('SELECT * FROM branches WHERE id = ?', id);
  if (!b || b.merchant_id !== req.user.merchant_id) fail(403, 'ما عندك صلاحية على هذا الفرع');
  return b;
}

r.get('/board', h((req, res) => {
  const b = branchFor(req);
  const live = db.all(`SELECT * FROM orders WHERE branch_id = ? AND status IN ('new','preparing','ready') ORDER BY id`, b.id).map(orders.serialize);
  const doneToday = db.all(`SELECT * FROM orders WHERE branch_id = ? AND status IN ('delivered','rejected','cancelled')
    AND date(created_at) = date('now') ORDER BY id DESC LIMIT 30`, b.id).map(orders.serialize);
  const merchant = db.one('SELECT id, name, color, logo FROM merchants WHERE id = ?', b.merchant_id);
  const branches = req.user.role === 'merchant' ? db.all('SELECT id, name FROM branches WHERE merchant_id = ?', b.merchant_id) : [];
  res.json({ branch: branchView(b), merchant, orders: live, done_today: doneToday, branches });
}));

r.post('/orders/:id/:action', h((req, res) => {
  const b = branchFor(req);
  const o = db.one('SELECT * FROM orders WHERE id = ? AND branch_id = ?', req.params.id, b.id);
  if (!o) fail(404, 'الطلب غير موجود');
  res.json(orders.staffAction(o, req.params.action));
}));

r.post('/toggle-open', h((req, res) => {
  const b = branchFor(req);
  db.run('UPDATE branches SET is_open = ? WHERE id = ?', b.is_open ? 0 : 1, b.id);
  res.json(branchView(db.one('SELECT * FROM branches WHERE id = ?', b.id)));
}));

r.get('/items', h((req, res) => {
  const b = branchFor(req);
  res.json(db.all('SELECT id, name, price, is_available FROM menu_items WHERE merchant_id = ? ORDER BY name', b.merchant_id));
}));

r.post('/items/:id/toggle', h((req, res) => {
  const b = branchFor(req);
  const it = db.one('SELECT * FROM menu_items WHERE id = ? AND merchant_id = ?', req.params.id, b.merchant_id);
  if (!it) fail(404, 'المنتج غير موجود');
  db.run('UPDATE menu_items SET is_available = ? WHERE id = ?', it.is_available ? 0 : 1, it.id);
  res.json({ id: it.id, is_available: !it.is_available });
}));

module.exports = r;
