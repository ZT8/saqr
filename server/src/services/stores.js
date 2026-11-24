// Store helpers: opening hours (Asia/Dubai), nearest branch, serialization.
const db = require('../db');
const { distanceMeters } = require('./core');

const DEFAULT_POS = { lat: 24.2075, lng: 55.7447 }; // Al Ain

function dubaiMinutesNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date());
  const hh = Number(parts.find((p) => p.type === 'hour').value) % 24;
  const mm = Number(parts.find((p) => p.type === 'minute').value);
  return hh * 60 + mm;
}
const toMin = (t) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };

function isOpen(b) {
  if (!b.is_open) return false;
  const now = dubaiMinutesNow(), o = toMin(b.open_time), c = toMin(b.close_time);
  return c > o ? now >= o && now < c : now >= o || now < c; // handles past-midnight closing
}

function fmtTime(t) {
  const m = toMin(t), hh = Math.floor(m / 60) % 24, mm = m % 60;
  const h12 = hh % 12 || 12, ampm = hh < 12 ? 'ص' : 'م';
  return `${h12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${ampm}`;
}

function branchView(b, pos) {
  const open = isOpen(b);
  const d = pos ? distanceMeters(pos, b) : null;
  return {
    ...b, open, distance_m: d,
    hours_label: open ? `مفتوح · يسكر ${fmtTime(b.close_time)}` : (b.is_open ? `مغلق · يفتح ${fmtTime(b.open_time)}` : 'مغلق مؤقتاً')
  };
}

function storeCard(m, pos) {
  const branches = db.all('SELECT * FROM branches WHERE merchant_id = ?', m.id).map((b) => branchView(b, pos));
  branches.sort((a, b) => (b.open - a.open) || ((a.distance_m ?? 0) - (b.distance_m ?? 0)));
  const nearest = branches[0] || null;
  return {
    id: m.id, name: m.name, category: m.category, tags: JSON.parse(m.tags || '[]'), color: m.color, logo: m.logo, cover: m.cover,
    branch: nearest, branches_count: branches.length
  };
}

function parsePos(q) {
  const lat = Number(q.lat), lng = Number(q.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat && lng ? { lat, lng } : DEFAULT_POS;
}

module.exports = { isOpen, branchView, storeCard, parsePos, fmtTime, DEFAULT_POS };
