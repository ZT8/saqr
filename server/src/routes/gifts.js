// Gifts: send an amount or a specific drink/meal to a phone number or a Around account,
// with a personal message and card design. Amount gifts credit the recipient's gift balance.
const express = require('express');
const db = require('../db');
const { h, fail, auth, notify, aed } = require('../services/core');
const payments = require('../services/payments');
const { normalizePhone } = require('./auth');

const r = express.Router();
r.use(auth);

const DESIGNS = ['green', 'orange', 'sand'];

function view(g) {
  const s = db.one('SELECT id, name, username, avatar FROM users WHERE id = ?', g.sender_id);
  const rcp = g.recipient_id ? db.one('SELECT id, name, username FROM users WHERE id = ?', g.recipient_id) : null;
  const m = g.merchant_id ? db.one('SELECT id, name, color, logo FROM merchants WHERE id = ?', g.merchant_id) : null;
  const it = g.item_id ? db.one('SELECT id, name, image FROM menu_items WHERE id = ?', g.item_id) : null;
  return { ...g, sender: s, recipient: rcp, merchant: m, item: it, title: g.kind === 'item' ? `${it.name} من ${m.name}` : aed(g.amount) };
}

r.post('/', h((req, res) => {
  const b = req.body;
  if (!['amount', 'item'].includes(b.kind)) fail(400, 'اختر نوع الهدية');
  // Recipient
  let recipient = null, phone = null;
  if (b.recipient_username) {
    recipient = db.one('SELECT * FROM users WHERE username = ?', String(b.recipient_username).replace(/^@/, '').toLowerCase());
    if (!recipient) fail(404, 'ما لقينا هذا الحساب');
  } else {
    phone = normalizePhone(b.recipient_phone);
    if (!phone) fail(400, 'رقم الهاتف غير صحيح');
    recipient = db.one('SELECT * FROM users WHERE phone = ?', phone);
  }
  if (recipient && recipient.id === req.user.id) fail(400, 'ما تقدر تهدي نفسك');

  let amount, merchantId = null, itemId = null;
  if (b.kind === 'amount') {
    amount = Math.round(Number(b.amount) * 100);
    if (!(amount >= 2500 && amount <= 100000)) fail(400, 'مبلغ الهدية من 25 إلى 1000 د.إ');
  } else {
    const it = db.one(`SELECT mi.*, m.status FROM menu_items mi JOIN merchants m ON m.id = mi.merchant_id WHERE mi.id = ?`, b.item_id);
    if (!it || it.status !== 'active') fail(400, 'المنتج غير متاح');
    amount = it.price; merchantId = it.merchant_id; itemId = it.id;
  }
  const message = String(b.message || '').trim().slice(0, 120);
  const design = DESIGNS.includes(b.design) ? b.design : 'green';

  const id = db.run(`INSERT INTO gifts (sender_id, recipient_phone, recipient_id, kind, amount, merchant_id, item_id, message, design, status, expires_at)
    VALUES (?,?,?,?,?,?,?,?,?, 'pending_payment', date('now','+6 months'))`,
    req.user.id, recipient ? recipient.phone : phone, recipient ? recipient.id : null, b.kind, amount, merchantId, itemId, message, design).lastInsertRowid;

  try { payments.charge('gift', id, amount, b.payment_method, b.card); }
  catch (e) { db.run('DELETE FROM gifts WHERE id = ?', id); throw e; }

  db.tx(() => {
    db.run(`UPDATE gifts SET status = 'sent' WHERE id = ?`, id);
    if (recipient && b.kind === 'amount') db.run('INSERT INTO gift_ledger (user_id, delta, gift_id) VALUES (?,?,?)', recipient.id, amount, id);
  });
  const g = view(db.one('SELECT * FROM gifts WHERE id = ?', id));
  if (recipient) {
    notify(recipient.id, `${req.user.name || 'شخص'} أرسل لك هدية`, `${g.title}${message ? ' · «' + message + '»' : ''}`, `/app/gifts/${id}`);
  } else {
    // Production: SMS with an install link. The gift is claimed automatically when this phone signs up.
    console.log(`[sms] ${phone}: ${req.user.name || 'صديقك'} أرسل لك هدية على Around (${g.title}). حمّل التطبيق واستلمها.`);
  }
  res.status(201).json({ ...g, delivered_to: recipient ? 'account' : 'sms' });
}));

r.get('/received', h((req, res) => {
  res.json(db.all(`SELECT * FROM gifts WHERE recipient_id = ? AND status IN ('sent','used') ORDER BY (status = 'sent') DESC, id DESC`, req.user.id).map(view));
}));
r.get('/sent', h((req, res) => {
  res.json(db.all(`SELECT * FROM gifts WHERE sender_id = ? AND status != 'pending_payment' ORDER BY id DESC`, req.user.id).map(view));
}));
r.get('/balance', h((req, res) => {
  res.json({ balance: db.one('SELECT COALESCE(SUM(delta),0) b FROM gift_ledger WHERE user_id = ?', req.user.id).b });
}));
r.get('/:id', h((req, res) => {
  const g = db.one('SELECT * FROM gifts WHERE id = ? AND (sender_id = ? OR recipient_id = ?)', req.params.id, req.user.id, req.user.id);
  if (!g) fail(404, 'الهدية غير موجودة');
  res.json(view(g));
}));

module.exports = r;
