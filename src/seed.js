'use strict';
// Demo data so judges see a living dashboard on first run.
// All domains, numbers and messages below are FICTIONAL examples generated for the demo.

const crypto = require('crypto');

function prng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const SCAMS = [
  { type: 'message', category: 'fake_fine', channel: 'sms', value: 'شرطة أبوظبي: لديك مخالفة مرورية غير مدفوعة بقيمة 400 درهم، ادفع خلال 24 ساعة لتجنب حجز المركبة adpolice-fines.com/pay' },
  { type: 'message', category: 'fake_fine', channel: 'sms', value: 'Dubai Police: unpaid fine AED 300. Pay within 24 hours to avoid impound: dubaipolice-fines.online' },
  { type: 'message', category: 'bank_otp', channel: 'call', value: 'هلا اخوي معك موظف البنك، بطاقتك موقوفة، عطني رمز التحقق اللي وصلك عشان نفعلها' },
  { type: 'message', category: 'bank_otp', channel: 'sms', value: 'Your bank card has been suspended. Verify your card number and CVV now: emiratesnbd-secure.xyz/verify' },
  { type: 'message', category: 'parcel', channel: 'sms', value: 'بريد الإمارات: طردك معلق بسبب نقص العنوان، ادفع 12 درهم لإعادة التوصيل emirates-post-redelivery.top' },
  { type: 'message', category: 'parcel', channel: 'whatsapp', value: 'Aramex: your shipment is on hold at customs, pay the AED 9.99 fee now aramex-track.click/fee' },
  { type: 'message', category: 'prize', channel: 'whatsapp', value: 'مبروك! ربحت 50,000 درهم في السحب الشهري، تواصل واتساب +882 1600 4471 لاستلام الجائزة' },
  { type: 'message', category: 'investment', channel: 'social', value: 'Guaranteed profit! Double your money in 7 days with our crypto plan cryptouae-profit.site' },
  { type: 'message', category: 'job', channel: 'whatsapp', value: 'وظيفة من البيت بدخل يومي 700 درهم بدون خبرة، فقط لايكات، تواصل واتساب 0559012345' },
  { type: 'message', category: 'family_emergency', channel: 'whatsapp', value: 'هلا يمه هذا رقمي الجديد تلفوني خربان، حولي لي 1500 درهم ضروري الحين' },
  { type: 'url', category: 'impersonation', channel: 'website', value: 'moi.gov.ae.fines-pay.com' },
  { type: 'url', category: 'impersonation', channel: 'sms', value: 'icp-update.cfd/emirates-id' },
  { type: 'url', category: 'shopping', channel: 'social', value: 'uae-mega-sale.shop' },
  { type: 'url', category: 'bank_otp', channel: 'email', value: 'dewa-bill.icu/pay' },
  { type: 'phone', category: 'bank_otp', channel: 'call', value: '+971 50 913 2207' },
  { type: 'phone', category: 'fake_fine', channel: 'call', value: '+971 56 448 1093' },
  { type: 'phone', category: 'prize', channel: 'call', value: '+882 1600 4471' },
  { type: 'phone', category: 'investment', channel: 'whatsapp', value: '+44 7700 900123' },
  { type: 'phone', category: 'job', channel: 'whatsapp', value: '0559012345' },
];
const EMIRATE_W = [['abu_dhabi', 28], ['dubai', 34], ['sharjah', 16], ['ajman', 8], ['ras_al_khaimah', 6], ['fujairah', 4], ['umm_al_quwain', 2], [null, 6]];

// A tiny valid PNG (solid colour) used as placeholder "screenshot" evidence in demo cases.
function placeholderPng(w = 240, h = 140, rgb = [222, 214, 198]) {
  const zlib = require('zlib');
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Campaign variants: same template, different domains/amounts — the radar should group them.
const FINE_VARIANTS = [
  'شرطة أبوظبي: لديك مخالفة مرورية غير مدفوعة بقيمة 300 درهم، ادفع خلال 24 ساعة لتجنب حجز المركبة adpolice-pay.com',
  'شرطة أبوظبي: لديك مخالفة مرورية غير مدفوعة بقيمة 750 درهم، يرجى الدفع خلال 24 ساعة لتجنب حجز المركبة ad-police-fines.xyz',
];
const ICP_SPIKE = [
  'الهوية الإماراتية: يجب تحديث بياناتك خلال 48 ساعة وإلا سيتم إيقاف الهوية، حدث بياناتك الآن icp-uae-renew.top/id',
  'الهوية الإماراتية: يجب تحديث بياناتك خلال 48 ساعة وإلا سيتم ايقاف الهوية نهائياً، حدث بياناتك icp-update.cfd/emirates-id',
  'تنبيه الهوية الإماراتية: يجب تحديث بياناتك خلال 48 ساعة وإلا سيتم إيقاف الهوية uae-id-update.sbs',
  'Emirates ID alert: you must update your details within 48 hours or your ID will be suspended uae-id-update.sbs/renew',
];

function seedDemo(svc, db, extras = {}) {
  const rand = prng(42);
  const pick = (w) => { let r = rand() * w.reduce((s, x) => s + x[1], 0); for (const [v, n] of w) { if ((r -= n) < 0) return v; } return w[0][0]; };
  const now = Date.now();
  let made = 0;
  for (let i = 0; i < 170; i++) {
    // More reports in recent days (growing awareness / campaign trend).
    const daysAgo = Math.floor(Math.pow(rand(), 1.6) * 30);
    const when = new Date(now - daysAgo * 864e5 - Math.floor(rand() * 864e5 * 0.9)).toISOString();
    const s = SCAMS[Math.floor(Math.pow(rand(), 1.3) * SCAMS.length)];
    const lost = rand() < 0.18 ? Math.round(200 + rand() * 4800) : null;
    try {
      svc.createReport({ ...s, emirate: pick(EMIRATE_W), amount_lost: lost }, { when, hash: crypto.randomBytes(8).toString('hex') });
      made++;
    } catch { /* duplicates are fine to skip */ }
  }
  // Authorities have already verified the most-reported indicators.
  const top = db.prepare("SELECT id FROM indicators WHERE status='pending' ORDER BY report_count DESC LIMIT 12").all();
  top.forEach((r, i) => svc.setStatus(r.id, i === 11 ? 'rejected' : 'verified', 'system-seed'));

  // Campaign variants spread over the month, plus an Emirates ID campaign spiking in the last 48 hours.
  for (let i = 0; i < 14; i++) {
    const when = new Date(now - Math.floor(rand() * 25) * 864e5 - Math.floor(rand() * 864e5)).toISOString();
    try { svc.createReport({ type: 'message', value: FINE_VARIANTS[i % 2], category: 'fake_fine', channel: 'sms', emirate: pick(EMIRATE_W) }, { when, hash: crypto.randomBytes(8).toString('hex') }); made++; } catch { /* skip */ }
  }
  for (let i = 0; i < 30; i++) {
    const hoursAgo = i < 26 ? rand() * 46 : 50 + rand() * 40;
    const when = new Date(now - hoursAgo * 3600e3).toISOString();
    try {
      svc.createReport({ type: 'message', value: ICP_SPIKE[i % ICP_SPIKE.length], category: 'impersonation', channel: i % 3 ? 'sms' : 'whatsapp', emirate: pick(EMIRATE_W), amount_lost: rand() < 0.1 ? Math.round(300 + rand() * 2000) : null }, { when, hash: crypto.randomBytes(8).toString('hex') });
      made++;
    } catch { /* skip */ }
  }

  // Demo extortion cases (encrypted like real ones).
  if (extras.cases) {
    const png = placeholderPng().toString('base64');
    extras.cases.create({ platform: 'instagram', demand: 'money', paid: 'no', emirate: 'dubai', description: 'شخص تواصل معي في انستقرام وبعد فترة هددني ينشر صور خاصة إذا ما حولت له 5000 درهم خلال يومين.', extorter: '@demo_account_123', files: [{ name: 'chat-screenshot.png', data: png }] });
    extras.cases.create({ platform: 'snapchat', demand: 'more_images', paid: 'no', description: 'Someone I met online is threatening to share a video unless I send more pictures. I blocked them but they created a new account.', extorter: 'snap: demo.user.77', contact: 'prefers email, provided in person' });
  }

  // Aggregate scan counters (no content is ever stored for scans).
  const ins = db.prepare('INSERT INTO scan_stats (day, type, level, count) VALUES (?, ?, ?, ?) ON CONFLICT(day,type,level) DO UPDATE SET count = count + excluded.count');
  for (let d = 0; d < 30; d++) {
    const day = new Date(now - d * 864e5).toISOString().slice(0, 10);
    const base = 40 + (30 - d) * 3;
    for (const [type, f] of [['message', 0.55], ['url', 0.3], ['phone', 0.15]]) {
      ins.run(day, type, 'safe', Math.round(base * f * (0.4 + rand() * 0.2)));
      ins.run(day, type, 'suspicious', Math.round(base * f * (0.25 + rand() * 0.1)));
      ins.run(day, type, 'dangerous', Math.round(base * f * (0.25 + rand() * 0.15)));
    }
  }
  return made;
}

module.exports = { seedDemo, placeholderPng };
