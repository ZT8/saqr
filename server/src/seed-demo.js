// Demo dataset. Exported as a function so the dev data switch can reload it in-process.
const fs = require('fs');
const path = require('path');
const db = require('./db');
const loyalty = require('./services/loyalty');
const { UPLOAD_DIR } = require('./services/uploads');

const ASSETS = path.join(__dirname, '..', 'seed-assets');
const img = (name) => {
  const target = `seed-${name}.jpg`;
  fs.copyFileSync(path.join(ASSETS, name + '.jpg'), path.join(UPLOAD_DIR, target));
  return '/uploads/' + target;
};
const AED = (n) => Math.round(n * 100);

const merchants = [
  {
    name: 'سدرة للقهوة المختصة', category: 'coffee', tags: ['قهوة', 'حلويات'], color: '#0C1D16', commission: 7, daysOld: 120,
    branches: [
      { name: 'الجيمي', area: 'الجيمي', city: 'العين', lat: 24.2380, lng: 55.7310, open: '06:00', close: '01:00', prep: 8 },
      { name: 'المويجعي', area: 'المويجعي', city: 'العين', lat: 24.2196, lng: 55.7225, open: '06:00', close: '00:00', prep: 10 }
    ],
    loyalty: { type: 'stamps', goal: 10, reward: 'المشروب العاشر مجاني', value: 26, expiry: 6 },
    menu: {
      'مشروبات ساخنة': [['سبانش لاتيه', 'إسبريسو دبل مع حليب محلّى', 22, 1], ['كرك', 'شاي بالحليب والهيل والزعفران', 8, 1], ['قهوة مقطرة V60', 'محصول اليوم، تحضير يدوي', 24], ['كورتادو', 'دبل شوت مع حليب مبخّر', 18], ['لاتيه زعفران', 'خاص بالمحل', 26, 1]],
      'مشروبات باردة': [['آيس سبانش لاتيه', 'على ثلج', 24, 1], ['كولد برو', 'منقوع 18 ساعة', 22], ['آيس ماتشا', 'ماتشا ياباني مع حليب', 25]],
      'حلويات': [['كوكيز شوكولاتة', 'طازج كل يوم', 12], ['تشيز كيك زعفران', 'قطعة', 28]]
    }
  },
  {
    name: 'برجر الدوّار', category: 'burger', tags: ['برجر', 'وجبات سريعة'], color: '#7A3E06', commission: 8, daysOld: 90,
    branches: [{ name: 'الطوية', area: 'الطوية', city: 'العين', lat: 24.2560, lng: 55.7650, open: '11:00', close: '03:00', prep: 15 }],
    loyalty: { type: 'points', goal: 300, reward: 'وجبة برجر مجانية', value: 38, expiry: 12 },
    menu: {
      'برجر': [['كلاسيك برجر', 'لحم أنجوس، جبن شيدر، صوص خاص', 32, 1], ['دبل سماش', 'قطعتين سماش مع جبن', 42, 1], ['برجر دجاج مقرمش', 'صدر دجاج مع كول سلو', 30]],
      'جانبي': [['بطاطس', 'مقرمشة مع ملح بحري', 12, 1], ['بطاطس بالجبن', 'صوص جبن وهالبينو', 18]],
      'مشروبات': [['ليمون نعناع', 'فريش', 14], ['مياه', '500 مل', 3]]
    }
  },
  {
    name: 'مخبز الفريج', category: 'bakery', tags: ['مخبوزات', 'فطور'], color: '#5A4A2A', commission: 6, daysOld: 10,
    branches: [{ name: 'المطارد', area: 'المطارد', city: 'العين', lat: 24.2190, lng: 55.7580, open: '05:30', close: '23:00', prep: 10 }],
    loyalty: { type: 'points', goal: 100, reward: 'خصم 15 د.إ', value: 15, expiry: 3 },
    menu: {
      'مخبوزات': [['كرواسون زبدة', 'طازج من الفرن', 9, 1], ['خبز رقاق بالجبن', 'جبن كرافت وزعتر', 7, 1], ['فطيرة زعتر', '', 6], ['بريوش شوكولاتة', '', 11]],
      'فطور': [['صحن فطور', 'بيض، جبن، زيتون، خبز', 29, 1], ['شكشوكة', 'مع خبز', 24]]
    }
  },
  {
    name: 'عصائر الواحة', category: 'juice', tags: ['عصائر', 'صحي'], color: '#B85C00', commission: 7, daysOld: 5,
    branches: [{ name: 'الهيلي', area: 'الهيلي', city: 'العين', lat: 24.2900, lng: 55.7800, open: '08:00', close: '02:00', prep: 6 }],
    loyalty: null,
    menu: {
      'عصائر طازجة': [['برتقال طازج', 'بدون سكر', 15, 1], ['مانجو', '', 17, 1], ['أفوكادو بالعسل', '', 22], ['أخضر ديتوكس', 'سبانخ، تفاح، خيار، ليمون', 20, 1]],
      'كوكتيل': [['كوكتيل الواحة', 'طبقات فواكه', 24]]
    }
  },
  {
    name: 'ركن الحلا', category: 'dessert', tags: ['حلويات', 'كيك'], color: '#9A2B4A', commission: 7, daysOld: 60,
    branches: [{ name: 'زاخر', area: 'زاخر', city: 'العين', lat: 24.1700, lng: 55.7400, open: '10:00', close: '01:00', prep: 12 }],
    loyalty: { type: 'stamps', goal: 8, reward: 'قطعة كيك مجانية', value: 28, expiry: 6 },
    menu: {
      'كيك': [['كيك زعفران', 'قطعة', 28, 1], ['كيك عسل', 'قطعة', 26, 1], ['تيراميسو', 'كأس', 30]],
      'آيس كريم': [['آيس كريم فانيلا', 'كوب', 14], ['آيس كريم تمر', 'كوب', 16, 1]]
    }
  },
  {
    name: 'بقالة الحي', category: 'grocery', tags: ['بقالة'], color: '#3A4640', commission: 4, daysOld: 200,
    branches: [{ name: 'الخالدية', area: 'الخالدية', city: 'أبوظبي', lat: 24.4750, lng: 54.3500, open: '00:00', close: '23:59', prep: 7 }],
    loyalty: null,
    menu: {
      'أساسيات': [['حليب طازج 1 لتر', '', 7, 1], ['خبز عربي', 'ربطة', 4, 1], ['بيض 15 حبة', '', 16], ['مياه 6 × 1.5 لتر', '', 12, 1]]
    }
  }
];

const pendingApplication = { name: 'كرك وشاي', category: 'coffee', owner: ['+971500000009', 'راشد'], branch: { area: 'العامرة', city: 'العين', lat: 24.2300, lng: 55.7000 } };

module.exports = function seedDemo() {
db.tx(() => {
  const merchantIds = [];
  const itemsByMerchant = {};
  const branchesByMerchant = {};
  for (const m of merchants) {
    const mid = db.run(`INSERT INTO merchants (name, category, tags, color, status, commission_pct, created_at) VALUES (?,?,?,?, 'active', ?, datetime('now', ?))`,
      m.name, m.category, JSON.stringify(m.tags), m.color, m.commission, `-${m.daysOld} days`).lastInsertRowid;
    merchantIds.push(mid);
    branchesByMerchant[mid] = m.branches.map((b) => db.run(`INSERT INTO branches (merchant_id, name, area, city, lat, lng, open_time, close_time, prep_minutes) VALUES (?,?,?,?,?,?,?,?,?)`,
      mid, b.name, b.area, b.city, b.lat, b.lng, b.open, b.close, b.prep).lastInsertRowid);
    itemsByMerchant[mid] = [];
    let sort = 0;
    for (const [cat, items] of Object.entries(m.menu)) {
      const cid = db.run('INSERT INTO menu_categories (merchant_id, name, sort) VALUES (?,?,?)', mid, cat, sort++).lastInsertRowid;
      for (const [name, desc, price, top] of items) {
        const iid = db.run('INSERT INTO menu_items (merchant_id, category_id, name, description, price, is_top) VALUES (?,?,?,?,?,?)', mid, cid, name, desc, AED(price), top ? 1 : 0).lastInsertRowid;
        itemsByMerchant[mid].push({ id: iid, name, price: AED(price) });
      }
    }
    if (m.loyalty) {
      db.run('INSERT INTO loyalty_programs (merchant_id, active, type, goal, reward_text, reward_value, expiry_months) VALUES (?,1,?,?,?,?,?)',
        mid, m.loyalty.type, m.loyalty.goal, m.loyalty.reward, AED(m.loyalty.value), m.loyalty.expiry);
    }
  }
  const [sidra, burger, bakery, juice, dessert] = merchantIds;

  // A pending application from the website (for the admin review demo)
  db.run(`INSERT INTO merchant_applications (business_name, category, contact_name, phone, city, area, branches, note) VALUES (?,?,?,?,?,?,?,?)`,
    pendingApplication.name, pendingApplication.category, pendingApplication.owner[1], pendingApplication.owner[0], pendingApplication.branch.city, pendingApplication.branch.area, 2, 'عندنا فرعين ونبي نبدأ بالعامرة');

  // Staff & owners
  db.run(`INSERT INTO users (phone, name, role) VALUES ('+971500000001','إدارة Around','admin')`);
  db.run(`INSERT INTO users (phone, name, role, merchant_id) VALUES ('+971500000002','مالك سدرة','merchant',?)`, sidra);
  db.run(`INSERT INTO users (phone, name, role, merchant_id, branch_id) VALUES ('+971500000003','موظف الجيمي','staff',?,?)`, sidra, branchesByMerchant[sidra][0]);
  db.run(`INSERT INTO users (phone, name, role, merchant_id) VALUES ('+971500000005','مالك برجر الدوار','merchant',?)`, burger);

  // Customers
  const people = [
    ['+971500000004', 'عميل تجريبي', 'demo'],
    ['+971500000011', 'سارة', 'sara.ain'], ['+971500000012', 'خالد', 'khalid_k'], ['+971500000013', 'مريم', 'mariam.m'],
    ['+971500000014', 'سعيد', 'saeed99'], ['+971500000015', 'دلال', 'dalal.al']
  ];
  const uid = {};
  for (const [phone, name, username] of people) uid[username] = db.run('INSERT INTO users (phone, name, username) VALUES (?,?,?)', phone, name, username).lastInsertRowid;
  const plates = ['أبوظبي', 'دبي', 'الشارقة'];
  const cars = {};
  Object.entries(uid).forEach(([u, id], i) => {
    cars[u] = db.run('INSERT INTO cars (user_id, make, color, plate_emirate, plate_code, plate_number, is_default) VALUES (?,?,?,?,?,?,1)',
      id, ['تويوتا لاندكروزر', 'نيسان باترول', 'لكزس ES', 'كيا سبورتاج', 'هيونداي توسان', 'شفروليه تاهو'][i], ['أبيض', 'رمادي', 'أسود', 'أحمر', 'فضي', 'أزرق'][i],
      plates[i % 3], String(1 + i * 3), String(12345 + i * 1111)).lastInsertRowid;
  });

  // Delivered orders (history), with loyalty earning
  const mkOrder = (user, mid, picks, daysAgo, rating) => {
    const car = db.one('SELECT * FROM cars WHERE id = ?', cars[user]);
    const items = picks.map(([idx, qty]) => ({ ...itemsByMerchant[mid][idx], qty }));
    const subtotal = items.reduce((a, x) => a + x.price * x.qty, 0);
    const pct = db.one('SELECT commission_pct p FROM merchants WHERE id = ?', mid).p;
    const when = `-${daysAgo} days`;
    const oid = db.run(`INSERT INTO orders (user_id, merchant_id, branch_id, car_id, car_label, plate_label, status, subtotal, total, commission, payment_method, payment_ref,
        created_at, accepted_at, ready_at, on_the_way_at, arrived_at, delivered_at, rating)
      VALUES (?,?,?,?,?,?, 'delivered', ?, ?, ?, 'card', 'seed', datetime('now',?), datetime('now',?,'+1 minutes'), datetime('now',?,'+8 minutes'),
        datetime('now',?,'+2 minutes'), datetime('now',?,'+9 minutes'), datetime('now',?,'+10 minutes'), ?)`,
      uid[user], mid, branchesByMerchant[mid][0], car.id, `${car.make} · ${car.color}`, `${car.plate_emirate} ${car.plate_code} · ${car.plate_number}`,
      subtotal, subtotal, Math.round(subtotal * pct / 100), when, when, when, when, when, when, rating || null).lastInsertRowid;
    items.forEach((x) => db.run('INSERT INTO order_items (order_id, item_id, name, unit_price, qty) VALUES (?,?,?,?,?)', oid, x.id, x.name, x.price, x.qty));
    loyalty.earn(db.one('SELECT * FROM orders WHERE id = ?', oid));
    return oid;
  };
  // Demo customer history: 7 coffee stamps, burger points, etc.
  mkOrder('demo', sidra, [[0, 2], [1, 1]], 21, 5);
  mkOrder('demo', sidra, [[0, 1], [4, 1]], 12, 5);
  mkOrder('demo', sidra, [[0, 1], [1, 1]], 3, 4);
  mkOrder('demo', burger, [[0, 2], [3, 2]], 6, 5);
  mkOrder('demo', bakery, [[0, 2], [4, 1]], 2, 5);
  for (let d = 0; d < 13; d++) {
    mkOrder(['sara.ain', 'khalid_k', 'mariam.m', 'saeed99', 'dalal.al'][d % 5], sidra, [[d % 5, 1 + (d % 2)]], d, 4 + (d % 2));
    if (d % 2 === 0) mkOrder(['khalid_k', 'saeed99', 'dalal.al'][d % 3], burger, [[d % 3, 1], [3, 1]], d, 5);
  }

  // Social graph + posts (some within 24h so they appear as stories)
  const follow = (a, b) => db.run('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?,?)', uid[a], uid[b]);
  ['sara.ain', 'khalid_k', 'mariam.m'].forEach((u) => follow('demo', u));
  follow('sara.ain', 'demo'); follow('mariam.m', 'demo'); follow('khalid_k', 'sara.ain'); follow('dalal.al', 'sara.ain');

  const postFrom = (user, mid, image, caption, hoursAgo, pinned = 0) => {
    const o = db.one(`SELECT id FROM orders WHERE user_id = ? AND merchant_id = ? AND status = 'delivered' ORDER BY id DESC`, uid[user], mid);
    return db.run(`INSERT INTO posts (user_id, order_id, merchant_id, image, caption, pinned, created_at) VALUES (?,?,?,?,?,?, datetime('now', ?))`,
      uid[user], o ? o.id : null, o ? mid : null, img(image), caption, pinned, `-${hoursAgo} hours`).lastInsertRowid;
  };
  const p1 = postFrom('sara.ain', sidra, 'latte', 'أحلى سبانش لاتيه في العين، وجاني لين السيارة', 2, 1);
  const p2 = postFrom('khalid_k', burger, 'burger', 'الدبل سماش هنا شي ثاني', 5);
  const p3 = postFrom('mariam.m', sidra, 'iced', 'آيس لاتيه للحر', 8);
  const p4 = postFrom('dalal.al', sidra, 'karak', 'كرك العصرية', 14, 1);
  const p5 = postFrom('saeed99', burger, 'burger', 'غدا اليوم', 30);
  const p6 = postFrom('sara.ain', sidra, 'croissant', 'فطور على السريع', 40);
  const p7 = postFrom('mariam.m', sidra, 'cake', 'تشيز كيك الزعفران', 60);
  postFrom('dalal.al', sidra, 'green', 'بداية صحية', 70);
  const likes = { [p1]: ['khalid_k', 'mariam.m', 'saeed99', 'dalal.al', 'demo'], [p2]: ['sara.ain', 'saeed99'], [p3]: ['sara.ain', 'demo'], [p4]: ['sara.ain', 'mariam.m', 'khalid_k'], [p5]: ['khalid_k'], [p6]: ['mariam.m'], [p7]: ['sara.ain', 'dalal.al'] };
  for (const [pid2, us] of Object.entries(likes)) us.forEach((u) => db.run('INSERT INTO likes (user_id, post_id) VALUES (?,?)', uid[u], pid2));
  db.run('INSERT INTO comments (post_id, user_id, body) VALUES (?,?,?)', p1, uid['mariam.m'], 'صدق أحلى لاتيه');
  db.run('INSERT INTO comments (post_id, user_id, body) VALUES (?,?,?)', p1, uid['khalid_k'], 'لازم أجربه');
  db.run('INSERT INTO comments (post_id, user_id, body) VALUES (?,?,?)', p2, uid['saeed99'], 'أفضل برجر في الطوية');
  // An open report for the admin moderation demo
  db.run('INSERT INTO reports (post_id, user_id, reason) VALUES (?,?,?)', p5, uid['dalal.al'], 'صورة مكررة');

  // Gifts waiting for the demo customer: an item gift + amount balance
  const latte = itemsByMerchant[sidra][0];
  db.run(`INSERT INTO gifts (sender_id, recipient_phone, recipient_id, kind, amount, merchant_id, item_id, message, design, status, expires_at)
    VALUES (?, '+971500000004', ?, 'item', ?, ?, ?, 'قهوتك عليّ اليوم، يومك سعيد', 'green', 'sent', date('now','+6 months'))`, uid['sara.ain'], uid.demo, latte.price, sidra, latte.id);
  const g2 = db.run(`INSERT INTO gifts (sender_id, recipient_phone, recipient_id, kind, amount, message, design, status, expires_at)
    VALUES (?, '+971500000004', ?, 'amount', ?, 'مبروك الوظيفة الجديدة!', 'orange', 'sent', date('now','+6 months'))`, uid['mariam.m'], uid.demo, AED(50)).lastInsertRowid;
  db.run('INSERT INTO gift_ledger (user_id, delta, gift_id) VALUES (?,?,?)', uid.demo, AED(50), g2);

  db.run('INSERT INTO favorites (user_id, merchant_id) VALUES (?,?)', uid.demo, sidra);
  db.run('INSERT INTO favorites (user_id, merchant_id) VALUES (?,?)', uid.demo, dessert);
  db.run('INSERT INTO notifications (user_id, title, body, link) VALUES (?,?,?,?)', uid.demo, 'سارة أرسلت لك هدية', 'سبانش لاتيه من سدرة للقهوة المختصة', '/app/gifts');
  void juice;
});

};
