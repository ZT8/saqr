// "Most ordered": computed from real delivered orders in the last 30 days, never typed by hand.
// An item qualifies when it sits in the top 10% of the merchant's menu (ties included) and has at least MIN_ORDERS units.
const db = require('../db');

const MIN_ORDERS = 3;
const DAYS = 30;

function counts(merchantId) {
  return new Map(db.all(`SELECT oi.item_id id, SUM(oi.qty) n FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.merchant_id = ? AND o.status = 'delivered' AND oi.item_id IS NOT NULL AND o.created_at >= datetime('now', ?)
    GROUP BY oi.item_id`, merchantId, `-${DAYS} days`).map((x) => [x.id, x.n]));
}

// Adds orders_30d and popular (computed) to each item. `popular` ignores the merchant's hide switch; callers use shown = popular && !badge_off.
function annotate(items, merchantId) {
  const c = counts(merchantId);
  const k = Math.max(1, Math.ceil(items.length * 0.1));
  const sorted = items.map((i) => c.get(i.id) || 0).sort((a, b) => b - a);
  const cutoff = Math.max(MIN_ORDERS, sorted[k - 1] || 0);
  return items.map((i) => {
    const n = c.get(i.id) || 0;
    const popular = n >= cutoff;
    return { ...i, orders_30d: n, popular, show_badge: popular && !i.badge_off };
  });
}

module.exports = { annotate, MIN_ORDERS, DAYS };
