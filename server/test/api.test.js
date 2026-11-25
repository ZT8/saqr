// End-to-end API tests on a fresh seeded database. Run: npm test
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'around-'));
process.env.AROUND_DB = path.join(TMP, 'test.db');
process.env.WAGFA_UPLOADS = path.join(TMP, 'uploads');
execFileSync(process.execPath, [path.join(__dirname, '..', 'src', 'seed.js')], { env: process.env });

const request = require('supertest');
const { createApp, db } = require('../src/app');
const app = createApp();

const login = async (phone) => {
  await request(app).post('/api/auth/otp/request').send({ phone }).expect(200);
  const r = await request(app).post('/api/auth/otp/verify').send({ phone, code: '1234' }).expect(200);
  return r.body.token;
};
const as = (t) => ({ Authorization: 'Bearer ' + t });
let customer, staff, merchant, admin, sara;

before(async () => {
  customer = await login('0500000004');
  staff = await login('0500000003');
  merchant = await login('+971500000002');
  admin = await login('971500000001');
  sara = await login('0500000011');
});

test('otp rejects wrong code and bad phones', async () => {
  await request(app).post('/api/auth/otp/request').send({ phone: '12345' }).expect(400);
  await request(app).post('/api/auth/otp/request').send({ phone: '0551112222' }).expect(200);
  await request(app).post('/api/auth/otp/verify').send({ phone: '0551112222', code: '0000' }).expect(400);
  const ok = await request(app).post('/api/auth/otp/verify').send({ phone: '0551112222', code: '1234' }).expect(200);
  assert.equal(ok.body.is_new, true);
});

test('home aggregates stories, quick reorder, favorites, loyalty', async () => {
  const r = await request(app).get('/api/home').set(as(customer)).expect(200);
  assert.ok(r.body.stories.length >= 3, 'stories rail');
  assert.ok(r.body.quick.length >= 2, 'quick ordering');
  assert.ok(r.body.favorites.some((s) => s.name.includes('سدرة')));
  const card = r.body.loyalty.find((c) => c.merchant.name.includes('سدرة'));
  assert.equal(card.balance, 7);
  assert.ok(r.body.near[0].branch.distance_m >= 0);
});

test('full order lifecycle with gift item, gift balance, geofence arrival, loyalty, story', async () => {
  const store = (await request(app).get('/api/stores?q=سدرة').set(as(customer))).body[0];
  const detail = (await request(app).get('/api/stores/' + store.id).set(as(customer))).body;
  const latte = detail.menu[0].items[0];
  const cars = (await request(app).get('/api/auth/cars').set(as(customer))).body;
  const giftItem = (await request(app).get('/api/gifts/received').set(as(customer))).body.find((g) => g.kind === 'item');
  const meBefore = (await request(app).get('/api/auth/me').set(as(customer))).body;
  assert.equal(meBefore.gift_balance, 5000);

  const o = (await request(app).post('/api/orders').set(as(customer)).send({
    branch_id: detail.branches.find((b) => b.name === 'الجيمي').id, car_id: cars[0].id,
    items: [{ item_id: latte.id, qty: 3 }], gift_id: giftItem.id, use_gift_balance: true, payment_method: 'card'
  }).expect(201)).body;
  assert.equal(o.status, 'new');
  assert.equal(o.gift_item_value, latte.price);
  assert.equal(o.gift_used, 5000);
  assert.equal(o.total, latte.price * 3 - 5000); // 66 - 50 = 16 AED on card
  assert.equal(o.items.length, 2);

  // staff board sees it; customer starts trip; far location -> ETA; near -> geofenced arrival
  const board = (await request(app).get('/api/branch/board').set(as(staff)).expect(200)).body;
  assert.ok(board.orders.some((x) => x.id === o.id));
  await request(app).post(`/api/branch/orders/${o.id}/accept`).set(as(staff)).expect(200);
  await request(app).post(`/api/orders/${o.id}/on-the-way`).set(as(customer)).expect(200);
  const far = (await request(app).post(`/api/orders/${o.id}/location`).set(as(customer)).send({ lat: 24.26, lng: 55.75 }).expect(200)).body;
  assert.ok(far.distance_m > 1000 && far.eta_minutes >= 2 && !far.arrived_at);
  const near = (await request(app).post(`/api/orders/${o.id}/location`).set(as(customer)).send({ lat: 24.23803, lng: 55.73102 }).expect(200)).body;
  assert.ok(near.arrived_at, 'geofence marks arrival');
  await request(app).post(`/api/branch/orders/${o.id}/deliver`).set(as(staff)).expect(409); // must be ready first
  await request(app).post(`/api/branch/orders/${o.id}/ready`).set(as(staff)).expect(200);
  const done = (await request(app).post(`/api/branch/orders/${o.id}/deliver`).set(as(staff)).expect(200)).body;
  assert.equal(done.status, 'delivered');

  const acc = (await request(app).get('/api/stores/' + store.id).set(as(customer))).body.loyalty;
  assert.equal(acc.balance, 10, '7 + 3 stamps (gift item excluded)');
  assert.equal(acc.can_redeem, true);

  // post a story from this order
  const post = (await request(app).post('/api/social/posts').set(as(customer))
    .field('caption', 'تجربة').field('order_id', String(o.id))
    .attach('image', path.join(__dirname, '..', 'seed-assets', 'latte.jpg')).expect(201)).body;
  assert.equal(post.merchant.id, store.id);
  assert.equal(post.items[0].name, latte.name);
  await request(app).post(`/api/orders/${o.id}/rate`).set(as(customer)).send({ rating: 5 }).expect(200);
});

test('redeem loyalty reward discounts the order', async () => {
  const store = (await request(app).get('/api/stores?q=سدرة').set(as(customer))).body[0];
  const detail = (await request(app).get('/api/stores/' + store.id).set(as(customer))).body;
  const cars = (await request(app).get('/api/auth/cars').set(as(customer))).body;
  const karak = detail.menu[0].items.find((i) => i.name === 'كرك');
  const o = (await request(app).post('/api/orders').set(as(customer)).send({
    branch_id: detail.branches.find((b) => b.name === 'الجيمي').id, car_id: cars[0].id, items: [{ item_id: karak.id, qty: 2 }], redeem_reward: true, payment_method: 'apple_pay'
  }).expect(201)).body;
  assert.equal(o.reward_discount, karak.price * 2); // reward cap 26 AED covers both karak
  assert.equal(o.total, 0);
  const after = (await request(app).get('/api/stores/' + store.id).set(as(customer))).body.loyalty;
  assert.equal(after.balance, 0);
  // reject -> reward restored
  await request(app).post(`/api/branch/orders/${o.id}/reject`).set(as(staff)).expect(200);
  const restored = (await request(app).get('/api/stores/' + store.id).set(as(customer))).body.loyalty;
  assert.equal(restored.balance, 10);
});

test('declined card cancels order; customer can cancel before acceptance with refund', async () => {
  const store = (await request(app).get('/api/stores?q=سدرة').set(as(customer))).body[0];
  const detail = (await request(app).get('/api/stores/' + store.id).set(as(customer))).body;
  const cars = (await request(app).get('/api/auth/cars').set(as(customer))).body;
  const item = detail.menu[0].items[1];
  await request(app).post('/api/orders').set(as(customer)).send({
    branch_id: detail.branches[0].id, car_id: cars[0].id, items: [{ item_id: item.id, qty: 1 }], payment_method: 'card', card: { number: '4000 0000 0000 0002' }
  }).expect(402);
  const o = (await request(app).post('/api/orders').set(as(customer)).send({
    branch_id: detail.branches[0].id, car_id: cars[0].id, items: [{ item_id: item.id, qty: 1 }], payment_method: 'card'
  }).expect(201)).body;
  const c = (await request(app).post(`/api/orders/${o.id}/cancel`).set(as(customer)).expect(200)).body;
  assert.equal(c.status, 'cancelled');
  const refunds = db.all(`SELECT * FROM payments WHERE purpose = 'order' AND ref_id = ? AND status = 'refunded'`, o.id);
  assert.equal(refunds.length, 1);
});

test('gifts: amount to new phone is claimed on signup; item gift to username', async () => {
  const g = (await request(app).post('/api/gifts').set(as(sara)).send({
    kind: 'amount', amount: 100, recipient_phone: '0559998888', message: 'هلا والله', design: 'orange', payment_method: 'card'
  }).expect(201)).body;
  assert.equal(g.delivered_to, 'sms');
  const newbie = await login('0559998888');
  const me = (await request(app).get('/api/auth/me').set(as(newbie))).body;
  assert.equal(me.gift_balance, 10000);
  const item = db.one(`SELECT id FROM menu_items WHERE name = 'كلاسيك برجر'`);
  const g2 = (await request(app).post('/api/gifts').set(as(sara)).send({ kind: 'item', item_id: item.id, recipient_username: '@demo', message: 'غداك عليّ', payment_method: 'card' }).expect(201)).body;
  assert.equal(g2.delivered_to, 'account');
  await request(app).post('/api/gifts').set(as(sara)).send({ kind: 'amount', amount: 10, recipient_username: 'demo', payment_method: 'card' }).expect(400);
});

test('social: feed tabs, like, comment, follow, report, admin removal', async () => {
  const fy = (await request(app).get('/api/social/feed?tab=foryou').set(as(customer)).expect(200)).body;
  assert.ok(fy.posts.length >= 5);
  const fol = (await request(app).get('/api/social/feed?tab=following').set(as(customer)).expect(200)).body;
  const allowed = new Set(['sara.ain', 'khalid_k', 'mariam.m', 'demo']);
  assert.ok(fol.posts.every((p) => allowed.has(p.user.username)));
  const p = fy.posts.find((x) => x.user.username === 'saeed99');
  const l = (await request(app).post(`/api/social/posts/${p.id}/like`).set(as(customer)).expect(200)).body;
  assert.equal(l.liked, true);
  await request(app).post(`/api/social/posts/${p.id}/comments`).set(as(customer)).send({ body: 'شكله لذيذ' }).expect(201);
  const f = (await request(app).post(`/api/social/users/${p.user.id}/follow`).set(as(customer)).expect(200)).body;
  assert.equal(f.following, true);
  await request(app).post(`/api/social/posts/${p.id}/report`).set(as(customer)).send({ reason: 'test' }).expect(200);
  const reports = (await request(app).get('/api/admin/reports').set(as(admin)).expect(200)).body;
  assert.ok(reports.some((x) => x.post_id === p.id));
  await request(app).post(`/api/admin/reports/${p.id}/remove`).set(as(admin)).expect(200);
  await request(app).get(`/api/social/posts/${p.id}`).set(as(customer)).expect(404);
});

test('merchant: loyalty config, menu CRUD, settlement; roles enforced', async () => {
  await request(app).get('/api/merchant/overview').set(as(customer)).expect(403);
  const lp = (await request(app).put('/api/merchant/loyalty').set(as(merchant)).send({ active: true, type: 'points', goal: 200, reward_text: 'مشروب مجاني', reward_value: 25, expiry_months: 12 }).expect(200)).body;
  assert.equal(lp.type, 'points');
  const cat = (await request(app).post('/api/merchant/categories').set(as(merchant)).send({ name: 'موسمي' }).expect(201)).body;
  const it = (await request(app).post('/api/merchant/items').set(as(merchant)).field('name', 'قهوة عربية').field('price', '9.5').field('category_id', String(cat.id)).expect(201)).body;
  assert.equal(it.price, 950);
  await request(app).patch('/api/merchant/items/' + it.id).set(as(merchant)).send({ is_available: 0 }).expect(200);
  const s = (await request(app).get('/api/merchant/settlement').set(as(merchant)).expect(200)).body;
  assert.equal(s.net, s.gross - s.commission);
  const ov = (await request(app).get('/api/merchant/overview').set(as(merchant)).expect(200)).body;
  assert.ok(ov.days.length >= 1);
});

test('join application -> no account until admin approves', async () => {
  const body = { business_name: 'شاي الضحى', category: 'coffee', contact_name: 'حمد', phone: '0557776666', city: 'العين', area: 'الجاهلي' };
  await request(app).post('/api/join').send(body).expect(201);
  await request(app).post('/api/join').send(body).expect(409);
  await request(app).post('/api/join').send({ ...body, phone: '0557776667', category: 'x' }).expect(400);
  // applying creates no merchant and no account
  assert.equal(db.one(`SELECT COUNT(*) n FROM users WHERE phone = '+971557776666'`).n, 0);
  assert.equal(db.one(`SELECT COUNT(*) n FROM merchants WHERE name = 'شاي الضحى'`).n, 0);
  const list = (await request(app).get('/api/admin/applications').set(as(admin)).expect(200)).body;
  const a = list.find((x) => x.business_name === 'شاي الضحى');
  assert.ok(a);
  await request(app).get('/api/admin/applications').expect(401);
  await request(app).post('/api/admin/applications/' + a.id + '/approve').set(as(admin)).send({ commission_pct: 6 }).expect(200);
  const owner = await login('0557776666');
  const me = (await request(app).get('/api/auth/me').set(as(owner))).body;
  assert.equal(me.role, 'merchant');
  const rej = (await request(app).post('/api/join').send({ ...body, phone: '0557776668' }).expect(201));
  const l2 = (await request(app).get('/api/admin/applications').set(as(admin))).body;
  await request(app).post('/api/admin/applications/' + l2.find((x) => x.phone === '+971557776668').id + '/reject').set(as(admin)).expect(200);
});

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('most ordered: computed from real delivered orders, merchant can hide the badge', async () => {
  const m = db.one(`SELECT merchant_id id FROM users WHERE phone LIKE '%500000002'`);
  const items = db.all('SELECT id FROM menu_items WHERE merchant_id = ? AND is_available = 1 ORDER BY id', m.id);
  assert.ok(items.length >= 2);
  const used = new Set(db.all('SELECT DISTINCT item_id FROM order_items').map((x) => x.item_id));
  const star = items[0];
  const other = items.find((i) => i.id !== star.id && !used.has(i.id));
  assert.ok(other, 'an item nobody ordered');
  const u = db.one(`SELECT id FROM users WHERE phone LIKE '%500000004'`);
  const b = db.one('SELECT id FROM branches WHERE merchant_id = ?', m.id);
  const before = (require('../src/services/popular').annotate(items, m.id).find((i) => i.id === star.id)).orders_30d;
  const oid = db.run(`INSERT INTO orders (user_id, merchant_id, branch_id, status, subtotal, total) VALUES (?,?,?, 'delivered', 1000, 1000)`, u.id, m.id, b.id).lastInsertRowid;
  db.run('INSERT INTO order_items (order_id, item_id, name, unit_price, qty) VALUES (?,?,?,?,?)', oid, star.id, 'x', 500, 9);
  db.run('INSERT INTO order_items (order_id, item_id, name, unit_price, qty) VALUES (?,?,?,?,?)', oid, other.id, 'y', 500, 1);

  let s = await request(app).get(`/api/stores/${m.id}`).set(as(customer)).expect(200);
  assert.equal(s.body.top_items[0].id, star.id);
  assert.ok(!s.body.top_items.some((i) => i.id === other.id), 'one sale is not "most ordered"');
  const first = s.body.menu.flatMap((c) => c.items).find((i) => i.id === star.id);
  assert.equal(first.orders_30d, before + 9);

  await request(app).patch(`/api/merchant/items/${star.id}`).set(as(merchant)).send({ badge_off: 1 }).expect(200);
  s = await request(app).get(`/api/stores/${m.id}`).set(as(customer)).expect(200);
  assert.ok(!s.body.top_items.some((i) => i.id === star.id), 'hidden by merchant');
});

test('banners: merchant submits, admin approves, appears in /home, tracked', async () => {
  const mine = await request(app).post('/api/merchant/banners').set(as(merchant)).field('title', 'عرض الصيف').attach('image', PNG, 'b.png').expect(201);
  assert.equal(mine.body.status, 'pending');
  let home = await request(app).get('/api/home').set(as(customer)).expect(200);
  assert.ok(!home.body.banners.some((b) => b.id === mine.body.id), 'pending is not public');

  const own = await request(app).post('/api/admin/banners/own').set(as(admin)).field('title', 'Around').attach('image', PNG, 'a.png').expect(201);
  assert.equal(own.body.status, 'active');
  await request(app).post(`/api/admin/banners/${mine.body.id}/approve`).set(as(admin)).expect(200);
  home = await request(app).get('/api/home').set(as(customer)).expect(200);
  assert.ok(home.body.banners.some((b) => b.id === mine.body.id) && home.body.banners.some((b) => b.id === own.body.id));
  assert.ok(home.body.banners.find((b) => b.id === mine.body.id).merchant_id, 'merchant banner links to its store');

  await request(app).post(`/api/banners/${mine.body.id}/view`).set(as(customer)).expect(200);
  await request(app).post(`/api/banners/${mine.body.id}/click`).set(as(customer)).expect(200);
  const list = await request(app).get('/api/merchant/banners').set(as(merchant)).expect(200);
  assert.deepEqual([list.body[0].views, list.body[0].clicks], [1, 1]);

  // editing a live merchant banner sends it back for review; ended banners disappear
  await request(app).patch(`/api/merchant/banners/${mine.body.id}`).set(as(merchant)).send({ title: 'عرض جديد' }).expect(200);
  home = await request(app).get('/api/home').set(as(customer)).expect(200);
  assert.ok(!home.body.banners.some((b) => b.id === mine.body.id));
  await request(app).patch(`/api/admin/banners/own/${own.body.id}`).set(as(admin)).send({ ends_at: '2020-01-01' }).expect(200);
  home = await request(app).get('/api/home').set(as(customer)).expect(200);
  assert.ok(!home.body.banners.some((b) => b.id === own.body.id));
  await request(app).get('/api/admin/banners/own').set(as(merchant)).expect(403);
});

test('merchant: pause orders, extra prep, filters and CSV', async () => {
  const m = db.one(`SELECT merchant_id id FROM users WHERE phone LIKE '%500000002'`);
  const b = db.one('SELECT * FROM branches WHERE merchant_id = ?', m.id);
  const branches = db.all('SELECT id FROM branches WHERE merchant_id = ?', m.id);
  for (const x of branches) await request(app).post(`/api/merchant/branches/${x.id}/pressure`).set(as(merchant)).send({ pause_minutes: 30, extra_prep: 10 }).expect(200);
  const st = await request(app).get(`/api/stores/${m.id}`).set(as(customer)).expect(200);
  assert.equal(st.body.branch.open, false);
  assert.equal(st.body.branch.hours_label, 'متوقف مؤقتاً');
  assert.equal(st.body.branch.paused, true);
  assert.equal(st.body.branch.prep_minutes, st.body.branch.prep_minutes && (db.one('SELECT prep_minutes p FROM branches WHERE id = ?', st.body.branch.id).p + 10));
  await request(app).post(`/api/merchant/branches/${b.id}/pressure`).set(as(merchant)).send({ extra_prep: 99 }).expect(400);
  for (const x of branches) await request(app).post(`/api/merchant/branches/${x.id}/pressure`).set(as(merchant)).send({ pause_minutes: 0, extra_prep: 0 }).expect(200);

  const all = await request(app).get('/api/merchant/orders').set(as(merchant)).expect(200);
  assert.ok(all.body.length > 0);
  const one = all.body[0];
  const byId = await request(app).get('/api/merchant/orders').query({ q: '#' + one.id }).set(as(merchant)).expect(200);
  assert.deepEqual(byId.body.map((o) => o.id), [one.id]);
  const none = await request(app).get('/api/merchant/orders').query({ status: 'rejected', from: '2000-01-01', to: '2000-01-02' }).set(as(merchant)).expect(200);
  assert.equal(none.body.length, 0);
  const csv = await request(app).get('/api/merchant/orders.csv').set(as(merchant)).expect(200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.equal(csv.text.split('\r\n').length, all.body.length + 1);
});

test('challenges: progress from delivered orders, claim once, bonus lands in loyalty', async () => {
  const m = db.one(`SELECT merchant_id id FROM users WHERE phone LIKE '%500000002'`);
  db.run(`INSERT INTO loyalty_programs (merchant_id, active, type, goal, reward_text, reward_value, expiry_months) VALUES (?,1,'stamps',10,'free',0,6)
    ON CONFLICT(merchant_id) DO UPDATE SET active = 1`, m.id);
  const u = db.one(`SELECT id FROM users WHERE phone LIKE '%500000011'`);
  const day = new Date().toISOString().slice(0, 10);
  const c = await request(app).post('/api/merchant/challenges').set(as(merchant)).send({ title: 'ثلاث طلبات', target_orders: 4, bonus: 3, starts_at: day, ends_at: day }).expect(201);
  await request(app).post('/api/merchant/challenges').set(as(merchant)).send({ title: 'x', target_orders: 1, bonus: 3, starts_at: day, ends_at: day }).expect(400);
  let st = await request(app).get(`/api/stores/${m.id}`).set(as(sara)).expect(200);
  let mine = st.body.challenges.find((x) => x.id === c.body.id);
  const base = mine.done;
  assert.equal(mine.can_claim, false);
  await request(app).post(`/api/challenges/${c.body.id}/claim`).set(as(sara)).expect(400);
  const b = db.one('SELECT id FROM branches WHERE merchant_id = ?', m.id);
  for (let i = base; i < 4; i++) db.run(`INSERT INTO orders (user_id, merchant_id, branch_id, status, subtotal, total) VALUES (?,?,?, 'delivered', 800, 800)`, u.id, m.id, b.id);
  st = await request(app).get(`/api/stores/${m.id}`).set(as(sara)).expect(200);
  mine = st.body.challenges.find((x) => x.id === c.body.id);
  assert.deepEqual([mine.done, mine.can_claim], [4, true]);
  const before = db.one('SELECT COALESCE(SUM(balance),0) b FROM loyalty_accounts WHERE user_id = ? AND merchant_id = ?', u.id, m.id).b;
  await request(app).post(`/api/challenges/${c.body.id}/claim`).set(as(sara)).expect(200);
  await request(app).post(`/api/challenges/${c.body.id}/claim`).set(as(sara)).expect(409);
  assert.equal(db.one('SELECT balance b FROM loyalty_accounts WHERE user_id = ? AND merchant_id = ?', u.id, m.id).b, before + 3);
});
