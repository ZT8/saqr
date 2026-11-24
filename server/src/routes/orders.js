// Customer order endpoints.
const express = require('express');
const db = require('../db');
const { h, fail, auth } = require('../services/core');
const orders = require('../services/orders');

const r = express.Router();
r.use(auth);

const mine = (req) => {
  const o = db.one('SELECT * FROM orders WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!o) fail(404, 'الطلب غير موجود');
  return o;
};

r.post('/', h((req, res) => res.status(201).json(orders.create(req.user, req.body))));

r.get('/', h((req, res) => {
  const rows = db.all(`SELECT * FROM orders WHERE user_id = ? AND status != 'pending_payment' ORDER BY id DESC LIMIT 50`, req.user.id);
  res.json(rows.map(orders.serialize));
}));

r.get('/:id', h((req, res) => res.json(orders.serialize(mine(req)))));
r.post('/:id/cancel', h((req, res) => res.json(orders.cancelByCustomer(mine(req)))));
r.post('/:id/on-the-way', h((req, res) => res.json(orders.startTrip(mine(req)))));
r.post('/:id/location', h((req, res) => res.json(orders.updateLocation(mine(req), Number(req.body.lat), Number(req.body.lng)))));
r.post('/:id/arrived', h((req, res) => {
  const o = mine(req);
  if (!orders.LIVE.includes(o.status)) fail(409, 'الطلب مو شغال');
  res.json(orders.markArrived(o));
}));
r.post('/:id/rate', h((req, res) => {
  const o = mine(req);
  const n = Math.round(Number(req.body.rating));
  if (o.status !== 'delivered') fail(409, 'قيّم بعد الاستلام');
  if (!(n >= 1 && n <= 5)) fail(400, 'التقييم من 1 إلى 5');
  db.run('UPDATE orders SET rating = ? WHERE id = ?', n, o.id);
  res.json({ ok: true });
}));

// Reorder: returns the cart lines that are still available, for the client to load.
r.get('/:id/reorder', h((req, res) => {
  const o = mine(req);
  const lines = db.all(`SELECT oi.item_id, oi.qty, mi.name, mi.price, mi.is_available FROM order_items oi
    JOIN menu_items mi ON mi.id = oi.item_id WHERE oi.order_id = ? AND oi.is_gift = 0`, o.id);
  res.json({ merchant_id: o.merchant_id, branch_id: o.branch_id, lines: lines.filter((l) => l.is_available), missing: lines.filter((l) => !l.is_available).map((l) => l.name) });
}));

module.exports = r;
