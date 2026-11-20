'use strict';
// DEV ONLY — never deployed. Worst-case data for stress-testing the UI (break-ui).
// Every value goes through the same services the real API uses (the data boundary),
// and every value is something a real user could produce or the longest the API accepts.

const crypto = require('crypto');
const { placeholderPng } = require('../src/seed');

const h = () => crypto.randomBytes(8).toString('hex');
const ago = (hours) => new Date(Date.now() - hours * 3600e3).toISOString();

// Realistic long values
const LONG_URL = 'https://secure-update.emiratesnbd-customer-verification-portal-ae.account-services-online.xyz/account/verify/identity?session=8f2c91a0d4e74b6f9c1e2a7b3d5f6091&lang=ar&redirect=home';
const LONG_DOMAIN = 'uae-federal-identity-and-citizenship-services-renewal-portal.top';
const LONG_MSG = 'عزيزي المتعامل، نود إبلاغكم بأنه تم رصد عملية دخول غير معتادة على حسابكم المصرفي من جهاز غير معروف في دولة أخرى، ولحماية أموالكم تم تعليق جميع البطاقات المرتبطة بالحساب مؤقتاً. يرجى تحديث بياناتكم وتأكيد هويتكم خلال 24 ساعة من استلام هذه الرسالة وإلا سيتم إغلاق الحساب نهائياً وتحويل الرصيد إلى حساب الأمانات حسب تعليمات المصرف المركزي. للتحديث اضغط على الرابط التالي ' + LONG_URL + ' أو تواصل مع خدمة العملاء على الرقم +971 50 913 2207 أو +44 7700 900123 أو 00971-4-555-0199 على مدار الساعة. شكراً لتعاونكم. ملاحظة: هذه الرسالة مرسلة آلياً، يرجى عدم الرد عليها.';
const ENGLISH_MSG = 'Dear valued customer, your Etisalat by e& postpaid account ending 4417 has been selected for a complimentary upgrade to 5G Unlimited. To activate before midnight please confirm your card details at etisalat-rewards-5g-upgrade.online and reply YES. Ref: UAE-5G-2026-11-20-000918274.';
const ONE_WORD = 'سلام';

function seedWorst(svc, db, { cases, family }) {
  // 1) A single indicator with a huge report count (pluralisation + number width)
  for (let i = 0; i < 1284; i++) {
    svc.createReport({ type: 'url', value: LONG_DOMAIN, category: 'impersonation', channel: i % 2 ? 'sms' : 'whatsapp', emirate: 'umm_al_quwain', amount_lost: i === 0 ? 99999999 : null }, { when: ago(i % 40), hash: h() });
  }
  // 2) Exactly one report (singular forms)
  svc.createReport({ type: 'phone', value: '+882 1600 0000 01', category: 'other', channel: 'other' }, { when: ago(3), hash: h() });
  // 3) Very long message with many embedded links and numbers
  svc.createReport({ type: 'message', value: LONG_MSG, category: 'bank_otp', channel: 'sms', emirate: 'ras_al_khaimah', amount_lost: 12500.5 }, { when: ago(1), hash: h() });
  svc.createReport({ type: 'message', value: ENGLISH_MSG, category: 'prize', channel: 'email' }, { when: ago(2), hash: h() });
  // 4) Very long URL with no break opportunities, and a one-word message
  for (let i = 0; i < 3; i++) svc.createReport({ type: 'url', value: LONG_URL, category: 'bank_otp', channel: 'website', emirate: 'fujairah' }, { when: ago(5 + i), hash: h() });
  for (let i = 0; i < 3; i++) svc.createReport({ type: 'message', value: ONE_WORD + ' ' + 'x'.repeat(i), category: 'family_emergency', channel: 'whatsapp' }, { when: ago(6), hash: h() });
  // 5) A campaign spanning many domains
  const many = ['id-renew-a.top', 'id-renew-b.sbs', 'uae-idcheck.click', 'icp-renew-now.cfd', 'eid-update-portal.live', 'uaeid-verify.shop', 'id-uae-gov.online', 'renew-emirates-id.site'];
  many.forEach((d, i) => {
    for (let k = 0; k < 2; k++) svc.createReport({ type: 'message', value: `Emirates ID alert: you must update your details within 48 hours or your ID will be suspended ${d}`, category: 'impersonation', channel: 'sms' }, { when: ago(i + k), hash: h() });
  });
  // Verify some so the public registry shows full values
  const top = db.prepare("SELECT id FROM indicators ORDER BY report_count DESC LIMIT 6").all();
  top.forEach((r) => svc.setStatus(r.id, 'verified', 'dev-fixture'));

  // 6) Extortion case at every limit
  const png = placeholderPng(1200, 800).toString('base64');
  cases.create({
    platform: 'other', demand: 'other', paid: 'yes', emirate: 'umm_al_quwain',
    description: ('تواصل معي شخص عبر حساب باسم مستعار وبعد أسابيع من المحادثة طلب صوراً ثم بدأ يهددني بنشرها لعائلتي وزملائي في العمل إذا لم أحوّل له مبالغ أسبوعية، وكلما حظرته أنشأ حساباً جديداً. ').repeat(14).slice(0, 3000),
    extorter: 'https://www.instagram.com/' + 'the.real.official.account.of.someone.who.definitely.is.not.a.scammer_2026_backup_account_number_seven'.slice(0, 160),
    contact: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com',
    files: Array.from({ length: 5 }, (_, i) => ({ name: `Screenshot 2026-11-20 at 23.4${i}.17 — Instagram direct message thread with threats (part ${i + 1} of 5) — keep for police.png`.slice(0, 120), data: png })),
  });

  // 7) Family circle with the longest label, many alerts and long shared text
  const fam = family.create('الوالدة الغالية أم محمد حفظها الله ورعاها'.slice(0, 40));
  const fakeResult = { level: 'dangerous', detectedType: 'message', score: 100, tactics: ['credentials', 'urgency', 'threat', 'payment', 'impersonation', 'off_platform'], reasons: [] };
  for (let i = 0; i < 12; i++) family.onElderScan(fam.elderToken, fakeResult, { shareText: i % 2 === 0, text: LONG_MSG });
  family.help(fam.elderToken);
  return { guardianToken: fam.guardianToken, elderToken: fam.elderToken };
}

module.exports = { seedWorst, LONG_MSG, LONG_URL };
