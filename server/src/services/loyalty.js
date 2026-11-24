// Per-merchant loyalty. Each merchant sets its own program (stamps or points),
// goal, reward and expiry. The platform only counts and displays.
const db = require('../db');

function program(merchantId) {
  return db.one('SELECT * FROM loyalty_programs WHERE merchant_id = ?', merchantId) || null;
}

function expiresAt(acc, prog) {
  if (!prog || !prog.expiry_months) return null;
  const d = new Date(acc.last_activity_at.replace(' ', 'T') + 'Z');
  d.setUTCMonth(d.getUTCMonth() + prog.expiry_months);
  return d.toISOString().slice(0, 10);
}

// Zero out balances whose expiry has passed (lazy, on read).
function account(userId, merchantId) {
  const prog = program(merchantId);
  let acc = db.one('SELECT * FROM loyalty_accounts WHERE user_id = ? AND merchant_id = ?', userId, merchantId);
  if (!acc) return { balance: 0, expires_at: null, program: prog };
  const exp = expiresAt(acc, prog);
  if (exp && acc.balance > 0 && exp < new Date().toISOString().slice(0, 10)) {
    db.run('UPDATE loyalty_accounts SET balance = 0 WHERE user_id = ? AND merchant_id = ?', userId, merchantId);
    db.run('INSERT INTO loyalty_events (user_id, merchant_id, delta, reason) VALUES (?,?,?,?)', userId, merchantId, -acc.balance, 'expired');
    acc = { ...acc, balance: 0 };
  }
  return { balance: acc.balance, expires_at: exp, program: prog };
}

function canRedeem(userId, merchantId) {
  const a = account(userId, merchantId);
  return !!(a.program && a.program.active && a.balance >= a.program.goal);
}

// Called when an order is delivered.
function earn(order) {
  const prog = program(order.merchant_id);
  if (!prog || !prog.active) return 0;
  let delta;
  if (prog.type === 'stamps') {
    delta = db.one('SELECT COALESCE(SUM(qty),0) n FROM order_items WHERE order_id = ? AND is_gift = 0', order.id).n;
  } else {
    delta = Math.floor((order.subtotal - order.reward_discount) / 100); // 1 point per AED
  }
  if (delta <= 0) return 0;
  db.run(
    `INSERT INTO loyalty_accounts (user_id, merchant_id, balance, last_activity_at) VALUES (?,?,?,datetime('now'))
     ON CONFLICT(user_id, merchant_id) DO UPDATE SET balance = balance + excluded.balance, last_activity_at = datetime('now')`,
    order.user_id, order.merchant_id, delta
  );
  db.run('INSERT INTO loyalty_events (user_id, merchant_id, delta, reason, order_id) VALUES (?,?,?,?,?)', order.user_id, order.merchant_id, delta, 'order', order.id);
  return delta;
}

function redeem(userId, merchantId, orderId) {
  const prog = program(merchantId);
  db.run(`UPDATE loyalty_accounts SET balance = balance - ?, last_activity_at = datetime('now') WHERE user_id = ? AND merchant_id = ?`, prog.goal, userId, merchantId);
  db.run('INSERT INTO loyalty_events (user_id, merchant_id, delta, reason, order_id) VALUES (?,?,?,?,?)', userId, merchantId, -prog.goal, 'redeem', orderId);
}

function refundRedeem(userId, merchantId, orderId) {
  const prog = program(merchantId);
  if (!prog) return;
  db.run('UPDATE loyalty_accounts SET balance = balance + ? WHERE user_id = ? AND merchant_id = ?', prog.goal, userId, merchantId);
  db.run('INSERT INTO loyalty_events (user_id, merchant_id, delta, reason, order_id) VALUES (?,?,?,?,?)', userId, merchantId, prog.goal, 'refund', orderId);
}

function cardsFor(userId) {
  const rows = db.all(
    `SELECT m.id, m.name, m.color, m.logo FROM loyalty_programs p JOIN merchants m ON m.id = p.merchant_id
     WHERE p.active = 1 AND m.status = 'active' AND (m.id IN (SELECT merchant_id FROM loyalty_accounts WHERE user_id = ?)
       OR m.id IN (SELECT merchant_id FROM favorites WHERE user_id = ?))`, userId, userId);
  return rows.map((m) => {
    const a = account(userId, m.id);
    return { merchant: m, balance: a.balance, expires_at: a.expires_at, program: a.program, can_redeem: a.balance >= a.program.goal };
  }).sort((x, y) => y.balance / y.program.goal - x.balance / x.program.goal);
}

module.exports = { program, account, canRedeem, earn, redeem, refundRedeem, cardsFor };
