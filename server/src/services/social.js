const db = require('../db');

function serializePosts(posts, viewerId) {
  if (!posts.length) return [];
  return posts.map((p) => {
    const u = db.one('SELECT id, name, username, avatar FROM users WHERE id = ?', p.user_id);
    const m = p.merchant_id ? db.one('SELECT id, name, color, logo FROM merchants WHERE id = ?', p.merchant_id) : null;
    const items = p.order_id && p.attach_order
      ? db.all('SELECT item_id, name, qty FROM order_items WHERE order_id = ? AND is_gift = 0', p.order_id) : [];
    const stats = db.one(`SELECT (SELECT COUNT(*) FROM likes WHERE post_id = ?) likes,
      (SELECT COUNT(*) FROM comments WHERE post_id = ?) comments`, p.id, p.id);
    const v = viewerId ? db.one(`SELECT
        EXISTS(SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?) liked,
        EXISTS(SELECT 1 FROM saves WHERE post_id = ? AND user_id = ?) saved,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?) following,
        EXISTS(SELECT 1 FROM story_views WHERE post_id = ? AND user_id = ?) seen`,
      p.id, viewerId, p.id, viewerId, viewerId, p.user_id, p.id, viewerId) : { liked: 0, saved: 0, following: 0, seen: 0 };
    return {
      id: p.id, image: p.image, caption: p.caption, created_at: p.created_at, pinned: !!p.pinned,
      user: u, merchant: p.attach_order ? m : null, order_id: p.attach_order ? p.order_id : null, items,
      likes: stats.likes, comments: stats.comments,
      liked: !!v.liked, saved: !!v.saved, following: !!v.following, seen: !!v.seen,
      mine: viewerId === p.user_id
    };
  });
}

module.exports = { serializePosts };
