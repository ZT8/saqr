'use strict';
// Message analysis = ML language model + explainable fraud-tactic rules
// + analysis of every link and phone number embedded in the message.

const { normalizeText, extractUrls, extractPhones } = require('./normalize');
const { analyzeUrl } = require('./url');
const { analyzePhone } = require('./phone');

// Each tactic: keywords in Arabic (any dialect/spelling, normalised at load) and English.
const TACTICS = {
  // floor: a tactic this telling makes the message at least that risky on its own.
  credentials: { points: 26, floor: 55, severity: 'high', words: ['رمز التحقق', 'رمز التفعيل', 'الرمز السري', 'الرقم السري', 'كلمه المرور', 'كلمة السر', 'الباسورد', 'كود التفعيل', 'عطني الكود', 'ارسل الكود', 'ارسل لي الكود', 'الكود اللي وصلك', 'الكود الي وصلك', 'الرمز اللي وصلك', 'الرمز الي وصلك', 'الرقم اللي وصلك', 'رقم البطاقه', 'رقم بطاقتك', 'بيانات البطاقه', 'بيانات بطاقتك', 'تاريخ انتهاء البطاقه', 'الرقم اللي ورا البطاقه', 'cvv', 'otp', 'pin', 'password', 'passcode', 'verification code', 'card number', 'card details', 'security code', 'the code you received', 'the code you got', 'code we just sent', 'send me the code', 'share the code', 'send the code'] },
  personal_data: { points: 14, floor: 40, severity: 'medium', words: ['تحديث بياناتك', 'حدث بياناتك', 'حدّث بياناتك', 'تحديث البيانات', 'تحديث المعلومات', 'بيانات حسابك', 'رقم الهويه', 'صوره الهويه', 'صوره الجواز', 'الهويه من الوجهين', 'الهويه الاماراتيه', 'جواز السفر', 'تاكيد هويتك', 'اكد هويتك', 'نتاكد من بياناتك', 'تاكيد بياناتك', 'اكد بياناتك', 'ارسل بياناتك', 'عطني بياناتك', 'update your details', 'bank details', 'emirates id', 'confirm your address', 'personal information', 'payment information', 'confirm your identity', 'verify your identity', 'photo of your id', 'passport copy'] },
  urgency: { points: 12, severity: 'medium', words: ['عاجل', 'فورا', 'خلال 24 ساعه', 'خلال 48 ساعه', 'خلال ساعه', 'خلال يومين', 'اليوم فقط', 'اخر فرصه', 'ضروري الحين', 'جدد الحين', 'ادفع الحين', 'حول الحين', 'بسرعه', 'قبل منتصف الليل', 'urgent', 'urgently', 'immediately', 'within 24 hours', 'within 48 hours', 'today only', 'last chance', 'right now', 'act now', 'limited places', 'expires today', 'before midnight'] },
  threat: { points: 16, floor: 35, severity: 'high', words: ['ايقاف', 'تم ايقاف', 'موقوف', 'معلق', 'تعليق حسابك', 'تم تعليق', 'بينقفل', 'ينقفل', 'بيتسكر', 'سيتم اغلاق', 'سيتم حذف', 'اغلاق حسابك', 'حظر', 'حجز المركبه', 'الاجراءات القانونيه', 'قضيه', 'بلاغ ضدك', 'القبض', 'قطع الخدمه', 'حذف حسابك', 'انتهت صلاحيه', 'منتهي الصلاحيه', 'نشاط غير معتاد', 'عمليه مشبوهه', 'suspended', 'blocked', 'locked', 'deactivated', 'legal action', 'arrest', 'case has been filed', 'impound', 'disconnected', 'will be deleted', 'will be closed', 'unusual activity', 'suspicious activity', 'has expired', 'expired'] },
  prize: { points: 18, floor: 40, severity: 'high', words: ['مبروك ربحت', 'مبروك فزت', 'ربحت', 'فزت', 'جايزه', 'جايزتك', 'الفايز', 'السحب', 'هديه مجانيه', 'هديتك', 'اربح', 'كاش باك', 'congratulations you', 'you won', 'you have won', 'winner', 'prize', 'reward', 'lottery', 'lucky', 'free gift', 'claim your', 'giveaway'] },
  payment: { points: 10, severity: 'medium', words: ['ادفع', 'دفع الرسوم', 'رسوم', 'سداد', 'سدد', 'حول لي', 'حولي لي', 'حول المبلغ', 'حول مبلغ', 'تحويل', 'غرامه', 'مخالفه', 'الكفاله', 'الجمارك', 'جدد', 'تجديد الاشتراك', 'pay now', 'pay the', 'fee', 'transfer', 'fine', 'customs', 'bail', 'deposit', 'overdue', 'renew now', 'top up'] },
  impersonation: { points: 8, severity: 'low', words: ['الشرطه', 'شرطه ابوظبي', 'شرطه دبي', 'من الشرطه', 'وزاره الداخليه', 'النيابه', 'الضابط', 'البنك', 'المصرف', 'موظف البنك', 'خدمه العملاء', 'خدمه عملاء', 'اتصالات', 'بريد الامارات', 'ارامكس', 'هييه الكهرباء', 'الهويه الاتحاديه', 'police', 'ministry', 'bank', 'aramex', 'dhl', 'emirates post', 'etisalat', 'dewa', 'officer', 'customer service', 'support team', 'whatsapp account'] },
  parcel: { points: 6, severity: 'low', words: ['شحنتك', 'طردك', 'طرد', 'الشحنه', 'التوصيل', 'parcel', 'package', 'shipment', 'delivery', 'redelivery'] },
  investment: { points: 18, floor: 40, severity: 'high', words: ['ارباح مضمونه', 'ربح مضمون', 'استثمر', 'فرصه استثماريه', 'العملات الرقميه', 'بدون مخاطره', 'دبل فلوسك', 'ضاعف فلوسك', 'ضاعف ارباحك', 'ضعف المبلغ', 'قرض بدون فوايد', 'قرض فوري', 'تمويل فوري', 'قرض بدون كفيل', 'guaranteed profit', 'guaranteed returns', 'double your money', 'invest', 'bitcoin', 'crypto', 'trading platform', 'passive income', 'loan approved', 'instant loan'] },
  job: { points: 12, floor: 35, severity: 'medium', words: ['وظيفه من البيت', 'دخل يومي', 'يوميا من البيت', 'دوام جزيي', 'بدون خبره', 'رسوم التاشيره', 'راتب عالي', 'براتب عالي', 'part time job', 'earn aed', 'daily income', 'work from home', 'liking videos', 'no experience', 'easy money'] },
  off_platform: { points: 6, severity: 'low', words: ['واتساب', 'الواتساب', 'تيليجرام', 'تلجرام', 'كلمنا', 'تواصل معنا', 'whatsapp', 'telegram', 'dm me', 'contact us'] },
  new_number: { points: 14, floor: 40, severity: 'medium', words: ['رقمي الجديد', 'تلفوني خربان', 'تلفوني طاح', 'جوالي خربان', 'new number', 'my phone broke'] },
  // Asks you to click/visit even when no link is visible yet (often sent in a follow-up message).
  call_to_action: { points: 10, severity: 'medium', words: ['اضغط على الرابط', 'اضغط هنا', 'اضغط الرابط', 'ادخل على الرابط', 'الدخول للرابط', 'الدخول على الرابط', 'عبر الرابط', 'من خلال الرابط', 'افتح الرابط', 'سجل دخولك', 'click here', 'click the link', 'tap the link', 'tap here', 'login to', 'log in to', 'sign in to', 'verify now', 'open the link'] },
};

const PROTECTIVE = ['لا تشاركه', 'لا تشارك هذا', 'لا تشاركها', 'لا تعطه', 'never share', 'do not share', "don't share"].map((w) => normalizeText(w));

function compile(word) {
  const w = normalizeText(word);
  if (/^[a-z0-9 ]+$/.test(w)) return { w, re: new RegExp(`(^|[^a-z0-9])${w.replace(/ /g, '\\s+')}([^a-z0-9]|$)`) };
  // Short Arabic words must stand alone (so "حظر" does not match inside a longer word).
  if (w.length <= 4 && !w.includes(' ')) return { w, re: new RegExp(`(^|[^\\p{L}])(و|ف|ب|ل|ال|وال|بال)?${w}([^\\p{L}]|$)`, 'u') };
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
  // Legitimate OTP/security notices *warn* you not to share the code. When the message only
  // delivers a code with that warning, the credential/brand words are not a request.
  const nt = normalizeText(text);
  if (PROTECTIVE.some((p) => nt.includes(p)) && !tactics.payment && !tactics.prize && !tactics.threat && !extractUrls(text).length) {
    delete tactics.credentials;
    delete tactics.impersonation;
    add('protective_notice', 0, 'safe');
  }
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
  if (officialClaim && (tactics.credentials || tactics.payment || tactics.personal_data || tactics.threat || links.length)) {
    add('combo_impersonation', 15, 'high');
    rulePoints += 15;
  }
  if (officialClaim && phones.some((p) => p.kind === 'uae_mobile' || p.kind === 'international')) {
    add('combo_official_personal_number', 10, 'medium');
    rulePoints += 10;
  }

  let score = mlPoints + Math.min(rulePoints, 50) + Math.round(maxLink * 0.5) + Math.round(maxPhone * 0.35);
  // With no tactic, link or number, only a confident language model can lift the score.
  if (!Object.keys(tactics).length && !links.length && !phones.length && pred.probability < 0.6) score = Math.min(score, 25);
  // Telling tactics set a minimum: asking for a code is suspicious however friendly the wording.
  const floor = Object.keys(tactics).reduce((m, k) => Math.max(m, TACTICS[k].floor || 0), 0);
  score = Math.max(score, floor);
  // Two or more distinct tactics together are the shape of a scam script.
  const strong = Object.keys(tactics).filter((k) => !['impersonation', 'parcel', 'off_platform'].includes(k)).length;
  if (strong >= 2) score = Math.max(score, 55 + 8 * (strong - 2));
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
