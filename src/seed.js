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

function seedDemo(svc, db) {
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

module.exports = { seedDemo };
