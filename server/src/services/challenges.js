// Merchant loyalty challenges: "N delivered orders between two dates -> bonus stamps/points".
// Progress is counted from real delivered orders; the reward goes through the merchant's loyalty program.
const db = require('../db');
const { fail } = require('./core');

const today = () => new Date().toISOString().slice(0, 10);

function progress(c, userId) {
  const n = db.one(`SELECT COUNT(*) n FROM orders WHERE user_id = ? AND merchant_id = ? AND status = 'delivered'
    AND date(created_at, '+4 hours') BETWEEN ? AND ?`, userId, c.merchant_id, c.starts_at, c.ends_at).n;
  const claimed = !!db.one('SELECT 1 x FROM challenge_claims WHERE challenge_id = ? AND user_id = ?', c.id, userId);
  return { id: c.id, title: c.title, target: c.target_orders, bonus: c.bonus, starts_at: c.starts_at, ends_at: c.ends_at,
    done: Math.min(n, c.target_orders), claimed, can_claim: !claimed && n >= c.target_orders };
}

// Challenges a customer can see for a store: running now, or finished but still unclaimed.
function forStore(merchantId, userId) {
  return db.all('SELECT * FROM challenges WHERE merchant_id = ? AND is_active = 1 AND starts_at <= ? ORDER BY ends_at', merchantId, today())
    .map((c) => progress(c, userId)).filter((p) => (p.ends_at >= today()) || p.can_claim);
}

function claim(userId, challengeId) {
  const c = db.one('SELECT * FROM challenges WHERE id = ? AND is_active = 1', challengeId);
  if (!c) fail(404, 'التحدي غير موجود');
  const prog = db.one('SELECT * FROM loyalty_programs WHERE merchant_id = ? AND active = 1', c.merchant_id);
  if (!prog) fail(409, 'المحل أوقف برنامج الولاء');
  return db.tx(() => {
    const p = progress(c, userId);
    if (p.claimed) fail(409, 'أخذت المكافأة قبل');
    if (!p.can_claim) fail(400, 'ما كملت التحدي للحين');
    db.run('INSERT INTO challenge_claims (challenge_id, user_id) VALUES (?,?)', c.id, userId);
    db.run(`INSERT INTO loyalty_accounts (user_id, merchant_id, balance, last_activity_at) VALUES (?,?,?,datetime('now'))
      ON CONFLICT(user_id, merchant_id) DO UPDATE SET balance = balance + excluded.balance, last_activity_at = datetime('now')`, userId, c.merchant_id, c.bonus);
    db.run('INSERT INTO loyalty_events (user_id, merchant_id, delta, reason) VALUES (?,?,?,?)', userId, c.merchant_id, c.bonus, 'challenge');
    return { ok: true, bonus: c.bonus };
  });
}

function fields(b, base = {}) {
  const f = {
    title: String(b.title ?? base.title ?? '').trim().slice(0, 60),
    target_orders: Math.round(Number(b.target_orders ?? base.target_orders)),
    bonus: Math.round(Number(b.bonus ?? base.bonus)),
    starts_at: b.starts_at ?? base.starts_at, ends_at: b.ends_at ?? base.ends_at,
    is_active: b.is_active !== undefined ? (b.is_active ? 1 : 0) : (base.is_active ?? 1)
  };
  if (!f.title) fail(400, 'اكتب اسم التحدي');
  if (!(f.target_orders >= 2 && f.target_orders <= 100)) fail(400, 'عدد الطلبات من 2 إلى 100');
  if (!(f.bonus >= 1 && f.bonus <= 1000)) fail(400, 'المكافأة غير صحيحة');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.starts_at || '') || !/^\d{4}-\d{2}-\d{2}$/.test(f.ends_at || '')) fail(400, 'حدد تاريخ البداية والنهاية');
  if (f.ends_at < f.starts_at) fail(400, 'تاريخ النهاية قبل البداية');
  return f;
}

module.exports = { forStore, claim, fields, progress };
