// Dev-only datasets: demo (kind data), worst (realistic worst case), empty (nothing yet).
// The worst case enters through the same boundary as demo data: the database.
// Every value is either a realistic UAE example or the longest the API accepts.
const db = require('./db');
const seedDemo = require('./seed-demo');

const TABLES = ['story_views', 'saves', 'likes', 'comments', 'reports', 'follows', 'posts', 'gift_ledger', 'payments',
  'order_items', 'orders', 'gifts', 'loyalty_events', 'loyalty_accounts', 'loyalty_programs', 'favorites', 'notifications',
  'cars', 'menu_items', 'menu_categories', 'otp_codes', 'merchant_applications', 'users', 'branches', 'merchants'];

let current = null;

function wipe() {
  db.pragma('foreign_keys = OFF');
  db.tx(() => {
    TABLES.forEach((t) => db.run(`DELETE FROM ${t}`));
    if (db.one("SELECT name FROM sqlite_master WHERE name='sqlite_sequence'")) db.run('DELETE FROM sqlite_sequence');
  });
  db.pragma('foreign_keys = ON');
}

const uid = (u) => db.one('SELECT id FROM users WHERE username = ?', u).id;
const mid = (n) => db.one('SELECT id FROM merchants WHERE name LIKE ?', n + '%').id;

function worst() {
  db.tx(() => {
    const sidra = mid('سدرة'), burger = mid('برجر'), bakery = mid('مخبز'), juice = mid('عصائر'), dessert = mid('ركن');
    // Store names at the 60-char limit, a one-letter name, a Latin name, an empty menu.
    db.run('UPDATE merchants SET name = ?, tags = ? WHERE id = ?', 'مطعم ومقهى الشيف عبدالرحمن للمأكولات الشعبية الإماراتية', JSON.stringify(['مأكولات شعبية', 'فطور إماراتي', 'قهوة عربية', 'حلويات', 'مشاوي', 'عائلي']), sidra);
    db.run('UPDATE merchants SET name = ? WHERE id = ?', 'Q', burger);
    db.run(`UPDATE merchants SET name = ?, tags = '[]' WHERE id = ?`, 'The Specialty Coffee Roasters & Brew Lab Al Ain', bakery);
    db.run('UPDATE merchants SET name = ? WHERE id = ?', 'عصائر وكوكتيلات الواحة الطازجة · فرع مول العين الجديد', juice);
    db.run('DELETE FROM menu_items WHERE merchant_id = ?', dessert);
    db.run('UPDATE branches SET name = ?, area = ? WHERE merchant_id = ? AND name = ?', 'مركز العين مول التجاري - البوابة الشرقية', 'المطوع', sidra, 'الجيمي');
    // Items: 60-char name, 200-char description, very high and very low prices, unavailable top item.
    const [first, second, third] = db.all('SELECT id FROM menu_items WHERE merchant_id = ? ORDER BY id', sidra);
    db.run('UPDATE menu_items SET name = ?, description = ?, price = ? WHERE id = ?',
      'ساندويتش دجاج مشوي بالجبن والفلفل الحار مع صوص الثوم الخاص',
      'خبز رقاق محمّص، صدر دجاج متبّل بالبهارات الإماراتية، جبن شيدر وموزاريلا، فلفل حار، خس، طماطم، ومخلل الخيار، يقدّم مع صوص الثوم الخاص بالمحل وبطاطس مقرمشة جانبية. يحتوي على: حليب، قمح، بيض.',
      145050, first.id);
    db.run('UPDATE menu_items SET name = ?, price = ? WHERE id = ?', 'Iced Spanish Latte with Oat Milk & Extra Shot (Large)', 50, second.id);
    db.run('UPDATE menu_items SET is_available = 0 WHERE id = ?', third.id);

    // People: 40-char Arabic name, Latin name with diacritics, emoji-first name, one-letter name.
    db.run('UPDATE users SET name = ?, username = ? WHERE username = ?', 'عبدالرحمن بن محمد بن سعيد آل نهيان الكعبي', 'abdulrahman_alkaabi1', 'demo');
    db.run('UPDATE users SET name = ?, username = ? WHERE username = ?', 'Aleksandra Wiśniewska-Kowalczyk', 'aleksandra.wk.2026', 'sara.ain');
    db.run('UPDATE users SET name = ? WHERE username = ?', '🌙 ليان', 'mariam.m');
    db.run('UPDATE users SET name = ?, username = NULL WHERE username = ?', 'ع', 'khalid_k');
    const demo = uid('abdulrahman_alkaabi1');
    db.run(`UPDATE cars SET make = ?, color = ?, plate_emirate = ?, plate_code = ?, plate_number = ? WHERE user_id = ?`,
      'مرسيدس بنز جي كلاس AMG G63 إصدار خاص', 'رمادي مطفي', 'رأس الخيمة', 'AA', '99999', demo);

    // Big counts: badges, likes, balances.
    const ins = db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)');
    for (let i = 0; i < 128; i++) ins.run(demo, `إشعار رقم ${i + 1}`, '');
    const post = db.one(`SELECT id FROM posts ORDER BY created_at DESC LIMIT 1`).id;
    const longCap = 'جربت اليوم الطلب من السيارة لأول مرة وصراحة التجربة كانت أسرع من الدرايف ثرو العادي بكثير، وصلت والطلب جاهز والموظف جاب لي القهوة لين الشباك. الطعم ممتاز والحرارة مضبوطة والكمية كبيرة. أنصح فيه الكل خصوصاً وقت الدوام الصبح لما يكون الزحمة قوية عند الفروع الثانية في العين.';
    db.run('UPDATE posts SET caption = ? WHERE id = ?', longCap.slice(0, 300), post);
    const insU = db.prepare(`INSERT INTO users (phone, name, username) VALUES (?,?,?)`);
    const insL = db.prepare('INSERT INTO likes (user_id, post_id) VALUES (?,?)');
    for (let i = 0; i < 1284; i++) { const u = insU.run('+97158' + String(1000000 + i), 'مستخدم ' + (i + 1), 'user' + (1000 + i)).lastInsertRowid; if (i < 1284) insL.run(u, post); }
    db.run('UPDATE gift_ledger SET delta = ? WHERE user_id = ?', 1284550, demo);
    db.run(`UPDATE gifts SET message = ? WHERE recipient_id = ? AND kind = 'item'`,
      'كل عام وأنت بخير يا أغلى صديق، هذي قهوتك عليّ اليوم وكل يوم، لا تنسى تصور الكوب وتنزله ستوري عشان أشوفه، أحبك في الله!', demo);
    // Loyalty: points near a huge goal, stamps goal above 10 (grid), an expired card.
    db.run(`UPDATE loyalty_programs SET type = 'points', goal = 100000, reward_text = ? WHERE merchant_id = ?`, 'رحلة لشخصين إلى صلالة شاملة الإقامة والفطور لمدة ثلاث ليالي', burger);
    db.run('UPDATE loyalty_accounts SET balance = 99999 WHERE user_id = ? AND merchant_id = ?', demo, burger);
    db.run(`UPDATE loyalty_programs SET goal = 12 WHERE merchant_id = ?`, sidra);
    db.run(`UPDATE loyalty_accounts SET last_activity_at = datetime('now','-2 years') WHERE user_id = ? AND merchant_id = ?`, demo, bakery);
    // A huge live order: 14 lines, qty 50, with the longest note.
    const items = db.all('SELECT * FROM menu_items WHERE merchant_id IN (?,?) AND is_available = 1', sidra, bakery).slice(0, 14);
    const car = db.one('SELECT * FROM cars WHERE user_id = ?', demo);
    const sub = items.reduce((a, it, i) => a + it.price * (i === 0 ? 50 : 1), 0);
    const b = db.one('SELECT id FROM branches WHERE merchant_id = ? ORDER BY id LIMIT 1', sidra).id;
    const oid = db.run(`INSERT INTO orders (user_id, merchant_id, branch_id, car_id, car_label, plate_label, status, subtotal, total, commission, payment_method, note, on_the_way_at, distance_m, eta_minutes)
      VALUES (?,?,?,?,?,?, 'preparing', ?, ?, ?, 'card', ?, datetime('now'), 18400, 37)`, demo, sidra, b, car.id, `${car.make} · ${car.color}`,
      `${car.plate_emirate} ${car.plate_code} · ${car.plate_number}`, sub, sub, Math.round(sub * 0.07),
      'الرجاء عدم إضافة السكر نهائياً للقهوة، والحليب يكون خالي الدسم، ونبي كل مشروب في كيس منفصل لأنها لموظفين مختلفين في المكتب، وشكراً مقدماً على التعاون').lastInsertRowid;
    items.forEach((it, i) => db.run('INSERT INTO order_items (order_id, item_id, name, unit_price, qty) VALUES (?,?,?,?,?)', oid, it.id, it.name, it.price, i === 0 ? 50 : 1));
  });
}

function empty() {
  db.tx(() => {
    ['story_views', 'saves', 'likes', 'comments', 'reports', 'posts', 'gift_ledger', 'payments', 'order_items', 'orders', 'gifts',
      'loyalty_events', 'loyalty_accounts', 'favorites', 'notifications', 'follows', 'cars'].forEach((t) => db.run(`DELETE FROM ${t}`));
    db.run(`UPDATE merchants SET status = 'pending'`);
  });
}

function load(name) {
  if (!['demo', 'worst', 'empty'].includes(name)) throw Object.assign(new Error('unknown dataset'), { status: 400 });
  wipe();
  seedDemo();
  if (name === 'worst') worst();
  if (name === 'empty') empty();
  current = name;
  return current;
}

module.exports = { load, current: () => current, OPTIONS: ['demo', 'worst', 'empty'] };
