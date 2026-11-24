// Database layer: SQLite via better-sqlite3 (synchronous, fast, single file).
// Schema is written in portable SQL so it can move to PostgreSQL later.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = process.env.AROUND_DB || path.join(__dirname, '..', 'data', 'around.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  username TEXT UNIQUE,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','staff','merchant','admin')),
  merchant_id INTEGER REFERENCES merchants(id),
  branch_id INTEGER REFERENCES branches(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  color TEXT NOT NULL,
  plate_emirate TEXT NOT NULL,
  plate_code TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS merchants (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  color TEXT NOT NULL DEFAULT '#0C1D16',
  logo TEXT,
  cover TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  commission_pct REAL NOT NULL DEFAULT 7,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  city TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  open_time TEXT NOT NULL DEFAULT '07:00',
  close_time TEXT NOT NULL DEFAULT '23:00',
  prep_minutes INTEGER NOT NULL DEFAULT 10,
  is_open INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,           -- fils (1 AED = 100 fils)
  image TEXT,
  is_available INTEGER NOT NULL DEFAULT 1,
  is_top INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, merchant_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  merchant_id INTEGER NOT NULL REFERENCES merchants(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  car_id INTEGER REFERENCES cars(id),
  car_label TEXT,
  plate_label TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','new','preparing','ready','delivered','rejected','cancelled')),
  subtotal INTEGER NOT NULL,
  reward_discount INTEGER NOT NULL DEFAULT 0,
  gift_used INTEGER NOT NULL DEFAULT 0,      -- paid from gift balance
  gift_item_value INTEGER NOT NULL DEFAULT 0, -- value of gifted items in this order
  total INTEGER NOT NULL,          -- charged to card
  commission INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_ref TEXT,
  gift_id INTEGER REFERENCES gifts(id),
  redeem_reward INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  source_post_id INTEGER,            -- ordered from a Around Social post
  distance_m INTEGER,
  eta_minutes INTEGER,
  on_the_way_at TEXT,
  arrived_at TEXT,
  accepted_at TEXT,
  ready_at TEXT,
  delivered_at TEXT,
  rating INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES menu_items(id),
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  is_gift INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('order','gift')),
  ref_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  provider TEXT NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id),
  merchant_id INTEGER REFERENCES merchants(id),
  image TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  in_explore INTEGER NOT NULL DEFAULT 1,
  attach_order INTEGER NOT NULL DEFAULT 1,
  pinned INTEGER NOT NULL DEFAULT 0,
  removed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);

CREATE TABLE IF NOT EXISTS likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE IF NOT EXISTS saves (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE IF NOT EXISTS story_views (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','removed','dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gifts (
  id INTEGER PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  recipient_phone TEXT,
  recipient_id INTEGER REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('amount','item')),
  amount INTEGER NOT NULL,          -- value in fils
  merchant_id INTEGER REFERENCES merchants(id),
  item_id INTEGER REFERENCES menu_items(id),
  message TEXT NOT NULL DEFAULT '',
  design TEXT NOT NULL DEFAULT 'green',
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','sent','used','expired')),
  used_order_id INTEGER REFERENCES orders(id),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Gift balance ledger (amount gifts). Positive = credit, negative = spend.
CREATE TABLE IF NOT EXISTS gift_ledger (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  delta INTEGER NOT NULL,
  gift_id INTEGER REFERENCES gifts(id),
  order_id INTEGER REFERENCES orders(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loyalty_programs (
  merchant_id INTEGER PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'stamps' CHECK (type IN ('stamps','points')),
  goal INTEGER NOT NULL DEFAULT 10,
  reward_text TEXT NOT NULL DEFAULT 'مشروب مجاني',
  reward_value INTEGER NOT NULL DEFAULT 0,   -- max discount in fils when redeemed
  expiry_months INTEGER NOT NULL DEFAULT 6   -- 0 = never
);

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, merchant_id)
);

CREATE TABLE IF NOT EXISTS loyalty_events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  merchant_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS merchant_applications (
  id INTEGER PRIMARY KEY,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  branches INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','rejected')),
  merchant_id INTEGER REFERENCES merchants(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

db.exec(SCHEMA);

// Small helpers
db.tx = (fn) => db.transaction(fn)();
db.one = (sql, ...p) => db.prepare(sql).get(...p);
db.all = (sql, ...p) => db.prepare(sql).all(...p);
db.run = (sql, ...p) => db.prepare(sql).run(...p);

module.exports = db;
