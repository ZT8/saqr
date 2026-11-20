'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Engine, redact } = require('../src/engine');
const { extractUrls, extractPhones, normalizeText } = require('../src/engine/normalize');

const engine = new Engine();
const scan = (value, type = 'auto') => engine.analyze({ type, value });

test('fake police fine with look-alike link is dangerous', () => {
  const r = scan('شرطة أبوظبي: لديك مخالفة غير مدفوعة، ادفع خلال 24 ساعة عبر adpolice-fines.com/pay');
  assert.equal(r.detectedType, 'message');
  assert.equal(r.level, 'dangerous');
  assert.ok(r.reasons.some((x) => x.code === 'combo_impersonation'));
  assert.ok(r.entities.some((e) => e.type === 'url' && e.level === 'dangerous'));
});

test('OTP request in Gulf dialect is detected', () => {
  const r = scan('هلا اخوي معك موظف البنك، عطني رمز التحقق اللي وصلك');
  assert.notEqual(r.level, 'safe');
  assert.ok(r.reasons.some((x) => x.code === 'tactic_credentials'));
});

test('normal chat messages stay safe', () => {
  for (const m of ['هلا اخوي، نتغدى اليوم؟', 'Did you get home safely?', 'Meeting moved to 3pm, bring your laptop']) {
    assert.equal(scan(m).level, 'safe', m);
  }
});

test('legitimate OTP delivery message (no request) is safe', () => {
  assert.equal(scan('Your verification code is 552211. Never share it with anyone.').level, 'safe');
});

test('official and trusted domains are safe', () => {
  assert.equal(scan('https://www.adpolice.gov.ae/en/services').level, 'safe');
  assert.equal(scan('https://tamm.abudhabi/').level, 'safe');
  assert.equal(scan('emiratesnbd.com').level, 'safe');
});

test('URL red flags', () => {
  assert.equal(scan('moi.gov.ae.fines-pay.com').level, 'dangerous');
  assert.equal(scan('http://emiratesnbd-secure-login.xyz/verify').level, 'dangerous');
  assert.equal(scan('emlratesnbd.com').level, 'dangerous'); // typosquat
  assert.equal(scan('http://192.168.10.5/login').level, 'suspicious');
  assert.ok(scan('bit.ly/abc123').reasons.some((r) => r.code === 'shortener'));
});

test('phone analysis', () => {
  assert.equal(scan('999').reasons[0].code, 'official_emergency');
  assert.equal(scan('050 123 4567').key, '+971501234567');
  assert.equal(scan('+882 1600 0123').level, 'suspicious');
  assert.ok(scan('+44 7700 900123').reasons.some((r) => r.code === 'international'));
});

test('registry: verified indicator forces dangerous', () => {
  const registry = (type, v) => (type === 'phone' && v === '+971509132207' ? { status: 'verified', report_count: 9 } : null);
  const r = engine.analyze({ type: 'auto', value: '+971 50 913 2207' }, registry);
  assert.equal(r.level, 'dangerous');
  const m = engine.analyze({ type: 'auto', value: 'call me now 0509132207' }, registry);
  assert.ok(m.reasons.some((x) => x.code === 'contains_verified_indicator'));
});

test('extractors and normalisation', () => {
  assert.deepEqual(extractUrls('ادفع هنا adpolice-fines.com/pay، شكرا'), ['adpolice-fines.com/pay']);
  assert.deepEqual(extractPhones('اتصل ٠٥٠١٢٣٤٥٦٧ او 784-1990-1234567-1'), ['0501234567']);
  assert.equal(normalizeText('إدفَعْ الغرامة'), 'ادفع الغرامه');
});

test('PII redaction removes victim data but keeps scammer indicators', () => {
  const { text, redactions } = redact('هويتي 784-1990-1234567-1 وبطاقتي 4111 1111 1111 1111 ايميلي a@b.com الرمز 908172 والمحتال 0501234567 adpolice-fines.com');
  assert.ok(!text.includes('4111'));
  assert.ok(!text.includes('784-1990'));
  assert.ok(!text.includes('a@b.com'));
  assert.ok(!text.includes("908172"));
  assert.ok(text.includes('0501234567'));
  assert.ok(text.includes('adpolice-fines.com'));
  assert.equal(redactions.card, 1);
});

test('learning loop: new verified samples change the model', () => {
  const e = new Engine();
  const msg = 'زكاة الفطر اونلاين حول المبلغ للحساب الخيري الجديد';
  const before = e.model.predict(msg).probability;
  e.retrain(Array.from({ length: 3 }, () => ({ text: msg, label: 'scam' })));
  assert.ok(e.model.predict(msg).probability > before);
});
