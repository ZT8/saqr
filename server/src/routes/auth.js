// Phone OTP login + profile + cars + notifications.
const express = require('express');
const db = require('../db');
const { h, fail, auth, signToken, tierFor } = require('../services/core');
const { upload, fileUrl } = require('../services/uploads');

const r = express.Router();

// UAE numbers: accept 05XXXXXXXX, 5XXXXXXXX, +9715XXXXXXXX, 9715XXXXXXXX.
function normalizePhone(raw) {
  const d = String(raw || '').replace(/[^\d]/g, '');
  let local = d;
  if (local.startsWith('00971')) local = local.slice(5);
  else if (local.startsWith('971')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);
  if (!/^5\d{8}$/.test(local)) return null;
  return '+971' + local;
}

const DEV_OTP = process.env.NODE_ENV !== 'production';

r.post('/otp/request', h((req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) fail(400, 'رقم الهاتف غير صحيح');
  const code = DEV_OTP ? '1234' : String(Math.floor(1000 + Math.random() * 9000));
  db.run(`INSERT INTO otp_codes (phone, code, attempts, expires_at) VALUES (?,?,0,?)
          ON CONFLICT(phone) DO UPDATE SET code = excluded.code, attempts = 0, expires_at = excluded.expires_at`,
    phone, code, Date.now() + 5 * 60 * 1000);
  // Production: send via SMS provider here (e.g. Twilio / local UAE SMS gateway).
  if (DEV_OTP) console.log(`[otp] ${phone} -> ${code}`);
  res.json({ phone, sent: true, dev_code: DEV_OTP ? code : undefined });
}));

r.post('/otp/verify', h((req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) fail(400, 'رقم الهاتف غير صحيح');
  const row = db.one('SELECT * FROM otp_codes WHERE phone = ?', phone);
  if (!row || row.expires_at < Date.now()) fail(400, 'انتهت صلاحية الرمز، اطلب رمز جديد');
  if (row.attempts >= 5) fail(429, 'محاولات كثيرة، اطلب رمز جديد');
  if (String(req.body.code) !== row.code) {
    db.run('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?', phone);
    fail(400, 'الرمز غير صحيح');
  }
  db.run('DELETE FROM otp_codes WHERE phone = ?', phone);
  let user = db.one('SELECT * FROM users WHERE phone = ?', phone);
  const isNew = !user;
  if (!user) {
    const id = db.run('INSERT INTO users (phone) VALUES (?)', phone).lastInsertRowid;
    user = db.one('SELECT * FROM users WHERE id = ?', id);
    // Claim gifts that were sent to this phone before the account existed.
    claimGiftsForPhone(user);
  }
  res.json({ token: signToken(user), user: publicMe(user), is_new: isNew || !user.name });
}));

function claimGiftsForPhone(user) {
  const gifts = db.all(`SELECT * FROM gifts WHERE recipient_phone = ? AND recipient_id IS NULL AND status = 'sent'`, user.phone);
  for (const g of gifts) {
    db.run('UPDATE gifts SET recipient_id = ? WHERE id = ?', user.id, g.id);
    if (g.kind === 'amount') db.run('INSERT INTO gift_ledger (user_id, delta, gift_id) VALUES (?,?,?)', user.id, g.amount, g.id);
  }
}

function publicMe(u) {
  return {
    id: u.id, phone: u.phone, name: u.name, username: u.username, avatar: u.avatar,
    role: u.role, merchant_id: u.merchant_id, branch_id: u.branch_id
  };
}

r.get('/me', auth, h((req, res) => {
  const u = req.user;
  const giftBalance = db.one('SELECT COALESCE(SUM(delta),0) b FROM gift_ledger WHERE user_id = ?', u.id).b;
  const unreadGifts = db.one(`SELECT COUNT(*) n FROM gifts WHERE recipient_id = ? AND status = 'sent'`, u.id).n;
  const unread = db.one('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND is_read = 0', u.id).n;
  const counts = db.one(`SELECT
      (SELECT COUNT(*) FROM follows WHERE followee_id = ?) followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?) following,
      (SELECT COUNT(*) FROM posts WHERE user_id = ? AND removed = 0) posts`, u.id, u.id, u.id);
  res.json({ ...publicMe(u), tier: tierFor(u.id), gift_balance: giftBalance, gifts_waiting: unreadGifts, unread_notifications: unread, ...counts });
}));

r.patch('/me', auth, h((req, res) => {
  const name = req.body.name != null ? String(req.body.name).trim().slice(0, 40) : req.user.name;
  let username = req.body.username != null ? String(req.body.username).trim().toLowerCase() : req.user.username;
  if (!name) fail(400, 'اكتب اسمك');
  if (username) {
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) fail(400, 'اسم المستخدم: 3 إلى 20 حرف إنجليزي أو أرقام');
    const taken = db.one('SELECT id FROM users WHERE username = ? AND id != ?', username, req.user.id);
    if (taken) fail(409, 'اسم المستخدم محجوز');
  } else {
    username = null;
  }
  db.run('UPDATE users SET name = ?, username = ? WHERE id = ?', name, username, req.user.id);
  res.json(publicMe(db.one('SELECT * FROM users WHERE id = ?', req.user.id)));
}));

r.post('/me/avatar', auth, upload.single('image'), h((req, res) => {
  if (!req.file) fail(400, 'أرفق صورة');
  db.run('UPDATE users SET avatar = ? WHERE id = ?', fileUrl(req.file), req.user.id);
  res.json({ avatar: fileUrl(req.file) });
}));

// ---- cars ----
const carLabel = (c) => `${c.make} · ${c.color}`;
const plateLabel = (c) => `${c.plate_emirate} ${c.plate_code} · ${c.plate_number}`;

r.get('/cars', auth, h((req, res) => {
  res.json(db.all('SELECT * FROM cars WHERE user_id = ? ORDER BY is_default DESC, id', req.user.id)
    .map((c) => ({ ...c, label: carLabel(c), plate: plateLabel(c) })));
}));

r.post('/cars', auth, h((req, res) => {
  const { make, color, plate_emirate, plate_code, plate_number } = req.body;
  if (![make, color, plate_emirate, plate_number].every((x) => x && String(x).trim())) fail(400, 'كمّل بيانات السيارة');
  if (!/^\d{1,5}$/.test(String(plate_number))) fail(400, 'رقم اللوحة أرقام فقط (حتى 5)');
  const has = db.one('SELECT COUNT(*) n FROM cars WHERE user_id = ?', req.user.id).n;
  const id = db.run('INSERT INTO cars (user_id, make, color, plate_emirate, plate_code, plate_number, is_default) VALUES (?,?,?,?,?,?,?)',
    req.user.id, String(make).trim(), String(color).trim(), plate_emirate, String(plate_code || '').trim(), String(plate_number), has ? 0 : 1).lastInsertRowid;
  const c = db.one('SELECT * FROM cars WHERE id = ?', id);
  res.status(201).json({ ...c, label: carLabel(c), plate: plateLabel(c) });
}));

r.delete('/cars/:id', auth, h((req, res) => {
  db.run('DELETE FROM cars WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
}));

// ---- notifications ----
r.get('/notifications', auth, h((req, res) => {
  const rows = db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50', req.user.id);
  db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', req.user.id);
  res.json(rows);
}));

module.exports = { router: r, normalizePhone, carLabel, plateLabel, claimGiftsForPhone };
