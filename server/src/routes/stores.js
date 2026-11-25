// Public browsing: home feed, categories, stores, store details, favorites, search.
const express = require('express');
const db = require('../db');
const banners = require('../services/banners');
const { annotate } = require('../services/popular');
const { h, fail, auth, optionalAuth } = require('../services/core');
const { storeCard, branchView, parsePos } = require('../services/stores');
const loyalty = require('../services/loyalty');
const { serializePosts } = require('../services/social');

const r = express.Router();

const CATEGORIES = [
  { key: 'coffee', name: 'قهوة' }, { key: 'burger', name: 'برجر' }, { key: 'restaurant', name: 'مطاعم' },
  { key: 'bakery', name: 'مخابز' }, { key: 'juice', name: 'عصائر' }, { key: 'dessert', name: 'حلويات' },
  { key: 'grocery', name: 'بقالة' }, { key: 'pharmacy', name: 'صيدليات' }
];

const activeMerchants = () => db.all(`SELECT * FROM merchants WHERE status = 'active'`);

r.get('/categories', (_req, res) => res.json(CATEGORIES));

r.get('/stores', optionalAuth, h((req, res) => {
  const pos = parsePos(req.query);
  const q = String(req.query.q || '').trim();
  const cat = String(req.query.category || '');
  let list = activeMerchants().map((m) => storeCard(m, pos)).filter((s) => s.branch);
  if (cat) list = list.filter((s) => s.category === cat);
  if (q) {
    const needle = q.toLowerCase();
    const itemHits = new Set(db.all('SELECT DISTINCT merchant_id FROM menu_items WHERE name LIKE ?', '%' + q + '%').map((x) => x.merchant_id));
    list = list.filter((s) => s.name.toLowerCase().includes(needle) || s.tags.some((t) => t.includes(q)) || itemHits.has(s.id));
  }
  const favs = req.user ? new Set(db.all('SELECT merchant_id FROM favorites WHERE user_id = ?', req.user.id).map((x) => x.merchant_id)) : new Set();
  list.forEach((s) => { s.favorite = favs.has(s.id); });
  list.sort((a, b) => (b.branch.open - a.branch.open) || (a.branch.distance_m - b.branch.distance_m));
  res.json(list);
}));

// Everything the customer home screen needs in one call.
r.get('/home', auth, h((req, res) => {
  const pos = parsePos(req.query);
  const uid = req.user.id;
  const stores = activeMerchants().map((m) => storeCard(m, pos)).filter((s) => s.branch);
  const favIds = new Set(db.all('SELECT merchant_id FROM favorites WHERE user_id = ?', uid).map((x) => x.merchant_id));
  stores.forEach((s) => { s.favorite = favIds.has(s.id); });

  const near = [...stores].sort((a, b) => (b.branch.open - a.branch.open) || (a.branch.distance_m - b.branch.distance_m));
  const newest = db.all(`SELECT id FROM merchants WHERE status = 'active' AND created_at >= datetime('now','-30 days') ORDER BY created_at DESC LIMIT 6`)
    .map((x) => stores.find((s) => s.id === x.id)).filter(Boolean);

  // Quick ordering: last distinct delivered orders, re-orderable in one tap.
  const recent = db.all(`SELECT o.*, m.name merchant_name, m.color, m.logo FROM orders o JOIN merchants m ON m.id = o.merchant_id
    WHERE o.user_id = ? AND o.status = 'delivered' ORDER BY o.id DESC LIMIT 12`, uid);
  const seen = new Set();
  const quick = [];
  for (const o of recent) {
    if (seen.has(o.merchant_id)) continue; seen.add(o.merchant_id);
    const items = db.all('SELECT name, qty FROM order_items WHERE order_id = ? AND is_gift = 0', o.id);
    const store = stores.find((s) => s.id === o.merchant_id);
    quick.push({ order_id: o.id, store, total: o.subtotal, items, count: items.reduce((a, i) => a + i.qty, 0), date: o.created_at });
    if (quick.length >= 5) break;
  }

  // Story rail: users with posts in the last 24h, followed users first, unseen first.
  const rail = db.all(`SELECT p.user_id, MAX(p.id) last_id, u.name, u.username, u.avatar,
      EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = p.user_id) followed,
      SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM story_views v WHERE v.user_id = ? AND v.post_id = p.id) THEN 1 ELSE 0 END) unseen
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.removed = 0 AND p.in_explore = 1 AND p.created_at >= datetime('now','-1 day') AND p.user_id != ?
    GROUP BY p.user_id ORDER BY followed DESC, (unseen > 0) DESC, last_id DESC LIMIT 20`, uid, uid, uid)
    .map((x) => ({ ...x, cover: db.one('SELECT image FROM posts WHERE id = ?', x.last_id).image, unseen: x.unseen > 0 }));

  const active = db.all(`SELECT o.id, o.status, m.name merchant_name FROM orders o JOIN merchants m ON m.id = o.merchant_id
    WHERE o.user_id = ? AND o.status IN ('new','preparing','ready') ORDER BY o.id DESC`, uid);

  res.json({
    categories: CATEGORIES,
    banners: banners.live(),
    stories: rail,
    quick,
    favorites: stores.filter((s) => s.favorite),
    loyalty: loyalty.cardsFor(uid).slice(0, 6),
    newest,
    near,
    active_orders: active
  });
}));

r.get('/stores/:id', optionalAuth, h((req, res) => {
  const m = db.one(`SELECT * FROM merchants WHERE id = ? AND status = 'active'`, req.params.id);
  if (!m) fail(404, 'المحل غير موجود');
  const pos = parsePos(req.query);
  const branches = db.all('SELECT * FROM branches WHERE merchant_id = ?', m.id).map((b) => branchView(b, pos))
    .sort((a, b) => (b.open - a.open) || (a.distance_m - b.distance_m));
  const cats = db.all('SELECT * FROM menu_categories WHERE merchant_id = ? ORDER BY sort, id', m.id);
  const items = annotate(db.all('SELECT * FROM menu_items WHERE merchant_id = ?', m.id), m.id)
    .sort((a, b) => (b.show_badge - a.show_badge) || (b.orders_30d - a.orders_30d) || (b.is_top - a.is_top) || (a.id - b.id));
  // "Most ordered" section: only items that really earned it, strongest first.
  const top = items.filter((i) => i.is_available && i.show_badge).slice(0, 6);
  const pinned = db.all(`SELECT * FROM posts WHERE merchant_id = ? AND removed = 0 AND (pinned = 1 OR created_at >= datetime('now','-1 day'))
    ORDER BY pinned DESC, id DESC LIMIT 10`, m.id);
  const out = {
    ...storeCard(m, pos),
    branches,
    menu: cats.map((c) => ({ ...c, items: items.filter((i) => i.category_id === c.id) })).filter((c) => c.items.length),
    top_items: top,
    stories: serializePosts(pinned, req.user && req.user.id),
    loyalty: null,
    favorite: false
  };
  if (req.user) {
    out.favorite = !!db.one('SELECT 1 FROM favorites WHERE user_id = ? AND merchant_id = ?', req.user.id, m.id);
    const a = loyalty.account(req.user.id, m.id);
    if (a.program && a.program.active) out.loyalty = { ...a, can_redeem: a.balance >= a.program.goal };
  } else {
    const p = loyalty.program(m.id);
    if (p && p.active) out.loyalty = { balance: 0, program: p, can_redeem: false };
  }
  res.json(out);
}));

r.post('/stores/:id/favorite', auth, h((req, res) => {
  const exists = db.one('SELECT 1 FROM favorites WHERE user_id = ? AND merchant_id = ?', req.user.id, req.params.id);
  if (exists) db.run('DELETE FROM favorites WHERE user_id = ? AND merchant_id = ?', req.user.id, req.params.id);
  else db.run('INSERT INTO favorites (user_id, merchant_id) VALUES (?,?)', req.user.id, req.params.id);
  res.json({ favorite: !exists });
}));

module.exports = { router: r, CATEGORIES };
