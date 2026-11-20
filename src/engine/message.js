'use strict';
// Message analysis = ML language model + explainable fraud-tactic rules
// + analysis of every link and phone number embedded in the message.

const { normalizeText, extractUrls, extractPhones } = require('./normalize');
const { analyzeUrl } = require('./url');
const { analyzePhone } = require('./phone');

// Each tactic: keywords in Arabic (any dialect/spelling, normalised at load) and English.
const TACTICS = {
  credentials: { points: 24, severity: 'high', words: ['رمز التحقق', 'رمز التفعيل', 'الرمز السري', 'الرقم السري', 'كلمه المرور', 'كلمة السر', 'الكود', 'كود التفعيل', 'عطني الكود', 'رقم البطاقه', 'تاريخ انتهاء البطاقه', 'cvv', 'otp', 'pin', 'password', 'verification code', 'card number', 'security code', 'the code you received', 'code we just sent'] },
  personal_data: { points: 12, severity: 'medium', words: ['تحديث بياناتك', 'حدث بياناتك', 'تحديث البيانات', 'بيانات حسابك', 'رقم الهويه', 'الهويه الاماراتيه', 'جواز السفر', 'update your details', 'bank details', 'emirates id', 'confirm your address', 'personal information', 'payment information'] },
  urgency: { points: 12, severity: 'medium', words: ['عاجل', 'فورا', 'خلال 24 ساعه', 'خلال ساعه', 'اليوم فقط', 'اخر فرصه', 'ضروري الحين', 'بسرعه', 'urgent', 'urgently', 'immediately', 'within 24 hours', 'today only', 'last chance', 'right now', 'act now', 'limited places'] },
  threat: { points: 15, severity: 'high', words: ['ايقاف', 'تم ايقاف', 'معلق', 'حظر', 'حجز المركبه', 'الاجراءات القانونيه', 'قضيه', 'بلاغ ضدك', 'القبض', 'قطع الخدمه', 'حذف حسابك', 'suspended', 'blocked', 'deactivated', 'legal action', 'arrest', 'case has been filed', 'impound', 'disconnected', 'will be deleted'] },
  prize: { points: 18, severity: 'high', words: ['مبروك', 'ربحت', 'فزت', 'جايزه', 'الفايز', 'السحب', 'هديه مجانيه', 'congratulations', 'you won', 'you have won', 'winner', 'prize', 'lottery', 'lucky', 'free gift', 'claim your'] },
  payment: { points: 10, severity: 'medium', words: ['ادفع', 'دفع الرسوم', 'رسوم', 'سداد', 'حول', 'تحويل', 'غرامه', 'مخالفه', 'الكفاله', 'الجمارك', 'pay now', 'pay the', 'fee', 'transfer', 'fine', 'customs', 'bail', 'deposit', 'overdue'] },
  impersonation: { points: 8, severity: 'low', words: ['الشرطه', 'شرطه ابوظبي', 'شرطه دبي', 'وزاره الداخليه', 'النيابه', 'الضابط', 'البنك', 'المصرف', 'موظف البنك', 'اتصالات', 'بريد الامارات', 'ارامكس', 'هييه الكهرباء', 'police', 'ministry', 'bank', 'aramex', 'dhl', 'emirates post', 'etisalat', 'dewa', 'officer', 'customer service', 'whatsapp account'] },
  parcel: { points: 6, severity: 'low', words: ['شحنتك', 'طردك', 'الشحنه', 'التوصيل', 'parcel', 'package', 'shipment', 'delivery', 'redelivery'] },
  investment: { points: 18, severity: 'high', words: ['ارباح مضمونه', 'استثمر', 'فرصه استثماريه', 'العملات الرقميه', 'بدون مخاطره', 'guaranteed profit', 'guaranteed returns', 'double your money', 'invest', 'bitcoin', 'crypto', 'trading platform', 'passive income'] },
  job: { points: 12, severity: 'medium', words: ['وظيفه من البيت', 'دخل يومي', 'دوام جزيي', 'بدون خبره', 'رسوم التاشيره', 'part time job', 'earn aed', 'daily income', 'work from home', 'liking videos', 'no experience'] },
  off_platform: { points: 6, severity: 'low', words: ['واتساب', 'الواتساب', 'تيليجرام', 'تلجرام', 'whatsapp', 'telegram', 'dm me'] },
  new_number: { points: 14, severity: 'medium', words: ['رقمي الجديد', 'تلفوني خربان', 'new number', 'my phone broke'] },
};

function compile(word) {
  const w = normalizeText(word);
  if (/^[a-z0-9 ]+$/.test(w)) return { w, re: new RegExp(`(^|[^a-z0-9])${w.replace(/ /g, '\\s+')}([^a-z0-9]|$)`) };
  return { w, re: null };
}
const COMPILED = Object.fromEntries(Object.entries(TACTICS).map(([k, v]) => [k, { ...v, words: v.words.map(compile) }]));

function detectTactics(text) {
  const t = normalizeText(text);
  const hits = {};
  for (const [name, tac] of Object.entries(COMPILED)) {
    const matched = tac.words.filter(({ w, re }) => (re ? re.test(t) : t.includes(w))).map(({ w }) => w);
    if (matched.length) hits[name] = [...new Set(matched)].slice(0, 3);
  }
  return hits;
}

function analyzeMessage(text, { model, registry = () => null } = {}) {
  const reasons = [];
  const add = (code, points, severity, params) => reasons.push({ code, points, severity, params });

  // 1) Language model
  const pred = model ? model.predict(text) : { probability: 0.5, topTerms: [] };
  const mlPoints = Math.round(pred.probability * 50);
  if (pred.probability >= 0.6) add('ml_scam_language', 0, pred.probability >= 0.85 ? 'high' : 'medium', { pct: Math.round(pred.probability * 100), terms: pred.topTerms });
  else if (pred.probability <= 0.35) add('ml_normal_language', 0, 'safe', { pct: Math.round((1 - pred.probability) * 100) });

  // 2) Fraud tactics (explainable rules)
  const tactics = detectTactics(text);
  let rulePoints = 0;
  for (const [name, terms] of Object.entries(tactics)) {
    const tac = TACTICS[name];
    rulePoints += tac.points;
    add('tactic_' + name, tac.points, tac.severity, { terms });
  }

  // 3) Embedded links and numbers
  const links = extractUrls(text).map((u) => analyzeUrl(u, registry));
  const phones = extractPhones(text).map((p) => analyzePhone(p, registry));
  const maxLink = links.reduce((m, l) => Math.max(m, l.score), 0);
  const maxPhone = phones.reduce((m, p) => Math.max(m, p.score), 0);
  if (links.length) add(maxLink >= 50 ? 'contains_risky_link' : 'contains_link', 0, maxLink >= 50 ? 'high' : 'low', { count: links.length });
  if (phones.length) add(maxPhone >= 50 ? 'contains_risky_phone' : 'contains_phone', 0, maxPhone >= 50 ? 'high' : 'low', { count: phones.length });

  // 4) Dangerous combinations
  const officialClaim = tactics.impersonation;
  if (officialClaim && (tactics.credentials || tactics.payment || links.length)) {
    add('combo_impersonation', 15, 'high');
    rulePoints += 15;
  }
  if (officialClaim && phones.some((p) => p.kind === 'uae_mobile' || p.kind === 'international')) {
    add('combo_official_personal_number', 10, 'medium');
    rulePoints += 10;
  }

  let score = mlPoints + Math.min(rulePoints, 50) + Math.round(maxLink * 0.5) + Math.round(maxPhone * 0.35);
  // A message with no tactics, no links/numbers and normal language stays low even if long.
  if (!Object.keys(tactics).length && !links.length && !phones.length) score = Math.min(score, pred.probability >= 0.9 ? 45 : 25);
  // A verified scam indicator inside the message decides the verdict.
  const entities = [...links, ...phones];
  if (entities.some((e) => e.reasons.some((r) => r.code === 'registry_verified'))) {
    add('contains_verified_indicator', 0, 'high');
    score = Math.max(score, 95);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    type: 'message',
    score,
    reasons,
    model: { probability: Number(pred.probability.toFixed(3)) },
    tactics: Object.keys(tactics),
    entities,
  };
}

module.exports = { analyzeMessage, detectTactics, TACTICS };
