// Order lifecycle: create+pay, accept, ready, deliver, reject/cancel (with refunds),
// on-the-way tracking with geofenced arrival, queue position.
const db = require('../db');
const { fail, realtime, notify, distanceMeters, etaMinutes, GEOFENCE_M, aed } = require('./core');
const { isOpen } = require('./stores');
const payments = require('./payments');
const loyalty = require('./loyalty');

const STATUS_AR = {
  pending_payment: 'بانتظار الدفع', new: 'بانتظار قبول الفرع', preparing: 'قيد التحضير', ready: 'جاهز',
  delivered: 'تم التسليم', rejected: 'رفضه الفرع', cancelled: 'ملغي'
};
const LIVE = ['new', 'preparing', 'ready'];

function queueAhead(o) {
  if (!LIVE.includes(o.status)) return 0;
  if (o.arrived_at) {
    return db.one(`SELECT COUNT(*) n FROM orders WHERE branch_id = ? AND status IN ('new','preparing','ready')
      AND arrived_at IS NOT NULL AND arrived_at < ? AND id != ?`, o.branch_id, o.arrived_at, o.id).n;
  }
  return db.one(`SELECT COUNT(*) n FROM orders WHERE branch_id = ? AND status IN ('new','preparing','ready') AND arrived_at IS NOT NULL`, o.branch_id).n;
}

function serialize(o) {
  const items = db.all('SELECT name, unit_price, qty, is_gift, item_id FROM order_items WHERE order_id = ?', o.id);
  const b = db.one('SELECT id, name, area, city, lat, lng, prep_minutes + extra_prep AS prep_minutes FROM branches WHERE id = ?', o.branch_id);
  const m = db.one('SELECT id, name, color, logo FROM merchants WHERE id = ?', o.merchant_id);
  const u = db.one('SELECT id, name, phone FROM users WHERE id = ?', o.user_id);
  return {
    ...o, status_label: STATUS_AR[o.status], items, branch: b, merchant: m,
    customer: { id: u.id, name: u.name, phone: u.phone },
    queue_ahead: queueAhead(o),
    can_cancel: o.status === 'new',
    on_the_way: !!o.on_the_way_at && !o.arrived_at
  };
}

function broadcast(orderId, event = 'order:update') {
  const o = db.one('SELECT * FROM orders WHERE id = ?', orderId);
  const data = serialize(o);
  realtime.toUser(o.user_id, event, data);
  realtime.toBranch(o.branch_id, event, data);
  realtime.toMerchant(o.merchant_id, event, data);
  return data;
}

function create(user, body) {
  const branch = db.one('SELECT * FROM branches WHERE id = ?', body.branch_id);
  if (!branch) fail(404, 'الفرع غير موجود');
  const merchant = db.one('SELECT * FROM merchants WHERE id = ?', branch.merchant_id);
  if (!merchant || merchant.status !== 'active') fail(400, 'المحل غير متاح');
  if (!isOpen(branch)) fail(400, 'الفرع مغلق الحين');

  const car = db.one('SELECT * FROM cars WHERE id = ? AND user_id = ?', body.car_id, user.id);
  if (!car) fail(400, 'اختر سيارتك عشان الفرع يعرفك');

  const lines = Array.isArray(body.items) ? body.items : [];
  const items = [];
  for (const l of lines) {
    const qty = Math.floor(Number(l.qty));
    if (!(qty >= 1 && qty <= 50)) fail(400, 'كمية غير صحيحة');
    const it = db.one('SELECT * FROM menu_items WHERE id = ? AND merchant_id = ?', l.item_id, merchant.id);
    if (!it) fail(400, 'منتج غير موجود');
    if (!it.is_available) fail(400, `${it.name} غير متوفر الحين`);
    items.push({ it, qty, is_gift: 0 });
  }

  // Item gift redemption (a drink/meal someone gifted this user at this merchant).
  let gift = null;
  if (body.gift_id) {
    gift = db.one(`SELECT * FROM gifts WHERE id = ? AND recipient_id = ? AND kind = 'item' AND status = 'sent'`, body.gift_id, user.id);
    if (!gift) fail(400, 'الهدية غير متاحة');
    if (gift.merchant_id !== merchant.id) fail(400, 'هذي الهدية من محل ثاني');
    const it = db.one('SELECT * FROM menu_items WHERE id = ?', gift.item_id);
    items.push({ it: { ...it, price: gift.amount }, qty: 1, is_gift: 1 });
  }
  if (!items.length) fail(400, 'السلة فاضية');

  const subtotal = items.reduce((a, x) => a + x.it.price * x.qty, 0);
  const giftItemValue = items.filter((x) => x.is_gift).reduce((a, x) => a + x.it.price, 0);
  let remaining = subtotal - giftItemValue;

  let rewardDiscount = 0;
  const prog = loyalty.program(merchant.id);
  if (body.redeem_reward) {
    if (!loyalty.canRedeem(user.id, merchant.id)) fail(400, 'نقاطك ما تكفي للمكافأة');
    const cap = prog.reward_value || Math.min(...items.filter((x) => !x.is_gift).map((x) => x.it.price));
    rewardDiscount = Math.min(cap, remaining);
    remaining -= rewardDiscount;
  }

  let giftUsed = 0;
  if (body.use_gift_balance) {
    const bal = db.one('SELECT COALESCE(SUM(delta),0) b FROM gift_ledger WHERE user_id = ?', user.id).b;
    giftUsed = Math.min(bal, remaining);
    remaining -= giftUsed;
  }

  const total = remaining;
  const gross = subtotal - rewardDiscount;
  const commission = Math.round(gross * merchant.commission_pct / 100);
  const method = total > 0 ? body.payment_method : (giftUsed ? 'gift_balance' : 'free');

  const orderId = db.tx(() => {
    const id = db.run(`INSERT INTO orders (user_id, merchant_id, branch_id, car_id, car_label, plate_label, status, subtotal,
        reward_discount, gift_used, gift_item_value, total, commission, payment_method, gift_id, redeem_reward, note, eta_minutes, source_post_id)
      VALUES (?,?,?,?,?,?,'pending_payment',?,?,?,?,?,?,?,?,?,?,?,?)`,
      user.id, merchant.id, branch.id, car.id, `${car.make} · ${car.color}`, `${car.plate_emirate} ${car.plate_code} · ${car.plate_number}`,
      subtotal, rewardDiscount, giftUsed, giftItemValue, total, commission, method, gift ? gift.id : null, rewardDiscount ? 1 : 0,
      String(body.note || '').slice(0, 200), null,
      body.source_post_id && db.one('SELECT 1 FROM posts WHERE id = ?', body.source_post_id) ? Number(body.source_post_id) : null).lastInsertRowid;
    const ins = db.prepare('INSERT INTO order_items (order_id, item_id, name, unit_price, qty, is_gift) VALUES (?,?,?,?,?,?)');
    items.forEach((x) => ins.run(id, x.it.id, x.it.name, x.it.price, x.qty, x.is_gift));
    return id;
  });

  try {
    const ref = total > 0 ? payments.charge('order', orderId, total, body.payment_method, body.card) : null;
    db.tx(() => {
      db.run(`UPDATE orders SET status = 'new', payment_ref = ? WHERE id = ?`, ref, orderId);
      if (giftUsed) db.run('INSERT INTO gift_ledger (user_id, delta, order_id) VALUES (?,?,?)', user.id, -giftUsed, orderId);
      if (rewardDiscount) loyalty.redeem(user.id, merchant.id, orderId);
      if (gift) db.run(`UPDATE gifts SET status = 'used', used_order_id = ? WHERE id = ?`, orderId, gift.id);
    });
  } catch (e) {
    db.run(`UPDATE orders SET status = 'cancelled' WHERE id = ?`, orderId);
    throw e;
  }
  const data = broadcast(orderId, 'order:new');
  realtime.toAdmin('order:new', { id: orderId });
  return data;
}

function refundAll(o) {
  if (o.total > 0) payments.refund('order', o.id);
  if (o.gift_used) db.run('INSERT INTO gift_ledger (user_id, delta, order_id) VALUES (?,?,?)', o.user_id, o.gift_used, o.id);
  if (o.redeem_reward) loyalty.refundRedeem(o.user_id, o.merchant_id, o.id);
  if (o.gift_id) db.run(`UPDATE gifts SET status = 'sent', used_order_id = NULL WHERE id = ?`, o.gift_id);
}

const TRANSITIONS = {
  accept: { from: ['new'], to: 'preparing', stamp: 'accepted_at' },
  ready: { from: ['preparing'], to: 'ready', stamp: 'ready_at' },
  deliver: { from: ['ready'], to: 'delivered', stamp: 'delivered_at' },
  reject: { from: ['new', 'preparing'], to: 'rejected' }
};

function staffAction(order, action) {
  const t = TRANSITIONS[action];
  if (!t) fail(400, 'إجراء غير معروف');
  if (!t.from.includes(order.status)) fail(409, 'حالة الطلب تغيّرت، حدّث الصفحة');
  db.tx(() => {
    db.run(`UPDATE orders SET status = ?${t.stamp ? `, ${t.stamp} = datetime('now')` : ''} WHERE id = ?`, t.to, order.id);
    if (action === 'reject') refundAll(order);
  });
  const name = db.one('SELECT name FROM merchants WHERE id = ?', order.merchant_id).name;
  const link = `/app/orders/${order.id}`;
  if (action === 'accept') notify(order.user_id, `${name} قبل طلبك`, 'بدأ تحضير طلبك. اضغط «أنا في الطريق» لما تتحرك.', link);
  if (action === 'ready') notify(order.user_id, 'طلبك جاهز', `طلب رقم ${order.id} جاهز في ${name}`, link);
  if (action === 'reject') notify(order.user_id, 'تم رفض طلبك', `رجّعنا لك ${aed(order.total + order.gift_used)} بالكامل`, link);
  if (action === 'deliver') {
    const earned = loyalty.earn({ ...order, status: 'delivered' });
    const unit = (loyalty.program(order.merchant_id) || {}).type === 'points' ? 'نقطة' : 'ختم';
    notify(order.user_id, 'بالعافية!', earned ? `كسبت ${earned} ${unit} عند ${name}. صوّر طلبك وشاركه.` : 'صوّر طلبك وشاركه في Around Social.', link);
  }
  return broadcast(order.id);
}

function cancelByCustomer(order) {
  if (order.status !== 'new') fail(409, 'ما تقدر تلغي بعد ما الفرع قبل الطلب');
  db.tx(() => { db.run(`UPDATE orders SET status = 'cancelled' WHERE id = ?`, order.id); refundAll(order); });
  return broadcast(order.id);
}

function startTrip(order) {
  if (!LIVE.includes(order.status)) fail(409, 'الطلب مو شغال');
  if (!order.on_the_way_at) db.run(`UPDATE orders SET on_the_way_at = datetime('now') WHERE id = ?`, order.id);
  return broadcast(order.id);
}

function updateLocation(order, lat, lng) {
  if (!LIVE.includes(order.status) || order.arrived_at) return serialize(order);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) fail(400, 'موقع غير صحيح');
  const b = db.one('SELECT lat, lng FROM branches WHERE id = ?', order.branch_id);
  const d = distanceMeters({ lat, lng }, b);
  if (!order.on_the_way_at) db.run(`UPDATE orders SET on_the_way_at = datetime('now') WHERE id = ?`, order.id);
  if (d <= GEOFENCE_M) return markArrived(order, d);
  db.run('UPDATE orders SET distance_m = ?, eta_minutes = ? WHERE id = ?', d, etaMinutes(d), order.id);
  return broadcast(order.id);
}

function markArrived(order, d = 0) {
  if (order.arrived_at) return serialize(order);
  db.run(`UPDATE orders SET arrived_at = datetime('now'), distance_m = ?, eta_minutes = 0 WHERE id = ?`, d, order.id);
  realtime.toBranch(order.branch_id, 'customer:arrived', { id: order.id, plate: order.plate_label, car: order.car_label });
  return broadcast(order.id);
}

module.exports = { create, serialize, staffAction, cancelByCustomer, startTrip, updateLocation, markArrived, broadcast, STATUS_AR, LIVE };
