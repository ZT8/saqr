// Around Social: posts/stories from real orders, feed (following / for you),
// likes, saves, comments, follows, reports, profiles.
const express = require('express');
const db = require('../db');
const { h, fail, auth, notify, realtime } = require('../services/core');
const { upload, fileUrl } = require('../services/uploads');
const { serializePosts } = require('../services/social');

const r = express.Router();
r.use(auth);

const VISIBLE = 'p.removed = 0';
const PAGE = 15;

r.get('/feed', h((req, res) => {
  const uid = req.user.id;
  const offset = Math.max(0, Number(req.query.offset) || 0);
  let rows;
  if (req.query.tab === 'following') {
    rows = db.all(`SELECT p.* FROM posts p WHERE ${VISIBLE} AND
      (p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?) OR p.user_id = ?)
      ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`, uid, uid, PAGE, offset);
  } else {
    // For you: newest public posts first; within the same day, more-liked posts rank higher.
    rows = db.all(`SELECT p.*, (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) lk FROM posts p
      WHERE ${VISIBLE} AND p.in_explore = 1 ORDER BY date(p.created_at) DESC, lk DESC, p.created_at DESC LIMIT ? OFFSET ?`, PAGE, offset);
  }
  res.json({ posts: serializePosts(rows, uid), next: rows.length === PAGE ? offset + PAGE : null });
}));

// Trending grid for Explore (last 7 days by likes).
r.get('/trending', h((req, res) => {
  const rows = db.all(`SELECT p.*, (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) lk FROM posts p
    WHERE ${VISIBLE} AND p.in_explore = 1 AND p.created_at >= datetime('now','-7 days') ORDER BY lk DESC, p.id DESC LIMIT 24`);
  res.json(serializePosts(rows, req.user.id));
}));

// A user's stories (last 24h), oldest first, like Instagram/Snapchat.
r.get('/stories/:userId', h((req, res) => {
  const rows = db.all(`SELECT p.* FROM posts p WHERE ${VISIBLE} AND p.user_id = ? AND p.created_at >= datetime('now','-1 day')
    AND (p.in_explore = 1 OR p.user_id = ? OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.followee_id = p.user_id))
    ORDER BY p.id ASC`, req.params.userId, req.user.id, req.user.id);
  res.json(serializePosts(rows, req.user.id));
}));

r.post('/posts/:id/view', h((req, res) => {
  db.run('INSERT OR IGNORE INTO story_views (user_id, post_id) VALUES (?,?)', req.user.id, req.params.id);
  res.json({ ok: true });
}));

r.post('/posts', upload.single('image'), h((req, res) => {
  if (!req.file) fail(400, 'صوّر طلبك أولاً');
  const caption = String(req.body.caption || '').slice(0, 300);
  const inExplore = req.body.in_explore === '0' ? 0 : 1;
  const attach = req.body.attach_order === '0' ? 0 : 1;
  let orderId = null, merchantId = null;
  if (req.body.order_id) {
    const o = db.one(`SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = 'delivered'`, req.body.order_id, req.user.id);
    if (!o) fail(400, 'تقدر تنشر بس من طلب استلمته');
    orderId = o.id; merchantId = o.merchant_id;
  }
  const id = db.run('INSERT INTO posts (user_id, order_id, merchant_id, image, caption, in_explore, attach_order) VALUES (?,?,?,?,?,?,?)',
    req.user.id, orderId, merchantId, fileUrl(req.file), caption, inExplore, attach).lastInsertRowid;
  const post = serializePosts([db.one('SELECT * FROM posts WHERE id = ?', id)], req.user.id)[0];
  if (merchantId) realtime.toMerchant(merchantId, 'post:new', post);
  res.status(201).json(post);
}));

r.delete('/posts/:id', h((req, res) => {
  db.run('DELETE FROM posts WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
}));

const post = (id) => {
  const p = db.one('SELECT * FROM posts WHERE id = ? AND removed = 0', id);
  if (!p) fail(404, 'المنشور غير موجود');
  return p;
};

r.post('/posts/:id/like', h((req, res) => {
  const p = post(req.params.id);
  const had = db.one('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?', req.user.id, p.id);
  if (had) db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', req.user.id, p.id);
  else {
    db.run('INSERT INTO likes (user_id, post_id) VALUES (?,?)', req.user.id, p.id);
    if (p.user_id !== req.user.id) notify(p.user_id, `${req.user.name || 'شخص'} عجبه منشورك`, '', `/app/social/post/${p.id}`);
  }
  res.json({ liked: !had, likes: db.one('SELECT COUNT(*) n FROM likes WHERE post_id = ?', p.id).n });
}));

r.post('/posts/:id/save', h((req, res) => {
  const p = post(req.params.id);
  const had = db.one('SELECT 1 FROM saves WHERE user_id = ? AND post_id = ?', req.user.id, p.id);
  if (had) db.run('DELETE FROM saves WHERE user_id = ? AND post_id = ?', req.user.id, p.id);
  else db.run('INSERT INTO saves (user_id, post_id) VALUES (?,?)', req.user.id, p.id);
  res.json({ saved: !had });
}));

r.get('/posts/:id', h((req, res) => res.json(serializePosts([post(req.params.id)], req.user.id)[0])));

r.get('/posts/:id/comments', h((req, res) => {
  post(req.params.id);
  res.json(db.all(`SELECT c.id, c.body, c.created_at, u.id user_id, u.name, u.username, u.avatar FROM comments c
    JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.id`, req.params.id));
}));

r.post('/posts/:id/comments', h((req, res) => {
  const p = post(req.params.id);
  const body = String(req.body.body || '').trim().slice(0, 300);
  if (!body) fail(400, 'اكتب تعليقك');
  const id = db.run('INSERT INTO comments (post_id, user_id, body) VALUES (?,?,?)', p.id, req.user.id, body).lastInsertRowid;
  if (p.user_id !== req.user.id) notify(p.user_id, `${req.user.name || 'شخص'} علّق على منشورك`, body, `/app/social/post/${p.id}`);
  res.status(201).json({ id, body, user_id: req.user.id, name: req.user.name, username: req.user.username, avatar: req.user.avatar });
}));

r.post('/posts/:id/report', h((req, res) => {
  const p = post(req.params.id);
  const reason = String(req.body.reason || 'محتوى غير لائق').slice(0, 200);
  const exists = db.one(`SELECT 1 FROM reports WHERE post_id = ? AND user_id = ? AND status = 'open'`, p.id, req.user.id);
  if (!exists) db.run('INSERT INTO reports (post_id, user_id, reason) VALUES (?,?,?)', p.id, req.user.id, reason);
  realtime.toAdmin('report:new', { post_id: p.id });
  res.json({ ok: true });
}));

r.post('/users/:id/follow', h((req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) fail(400, 'ما تقدر تتابع نفسك');
  if (!db.one('SELECT 1 FROM users WHERE id = ?', id)) fail(404, 'المستخدم غير موجود');
  const had = db.one('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', req.user.id, id);
  if (had) db.run('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', req.user.id, id);
  else {
    db.run('INSERT INTO follows (follower_id, followee_id) VALUES (?,?)', req.user.id, id);
    notify(id, `${req.user.name || 'شخص'} بدأ يتابعك`, '', `/app/social/user/${req.user.id}`);
  }
  res.json({ following: !had });
}));

r.get('/users/:id', h((req, res) => {
  const u = db.one('SELECT id, name, username, avatar FROM users WHERE id = ?', req.params.id);
  if (!u) fail(404, 'المستخدم غير موجود');
  const stats = db.one(`SELECT (SELECT COUNT(*) FROM follows WHERE followee_id = ?) followers,
    (SELECT COUNT(*) FROM follows WHERE follower_id = ?) following,
    EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?) is_following`, u.id, u.id, req.user.id, u.id);
  const mine = u.id === req.user.id;
  const posts = db.all(`SELECT * FROM posts WHERE user_id = ? AND removed = 0 ${mine ? '' : 'AND in_explore = 1'} ORDER BY id DESC LIMIT 60`, u.id);
  const saved = mine ? db.all(`SELECT p.* FROM saves s JOIN posts p ON p.id = s.post_id WHERE s.user_id = ? AND p.removed = 0 ORDER BY s.rowid DESC LIMIT 60`, u.id) : [];
  res.json({ ...u, ...stats, is_following: !!stats.is_following, mine, posts: serializePosts(posts, req.user.id), saved: serializePosts(saved, req.user.id) });
}));

r.get('/search', h((req, res) => {
  const q = '%' + String(req.query.q || '').trim() + '%';
  res.json(db.all(`SELECT id, name, username, avatar FROM users WHERE role = 'customer' AND (name LIKE ? OR username LIKE ?) LIMIT 20`, q, q));
}));

module.exports = r;
