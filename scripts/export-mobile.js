'use strict';
// Generates the mobile app's offline engine data from the server engine, so both use one source:
//   mobile/assets/offline/engine.json   tactics, URL/phone lists, regexes, trained language model
//   mobile/assets/offline/training.json every practice question with the engine's explanation
//   mobile/test/fixtures/parity.json    server verdicts the Dart engine must reproduce
// Run after changing the engine: npm run mobile:export
const fs = require('fs');
const path = require('path');
const { Engine } = require('../src/engine');
const { TACTICS, PROTECTIVE } = require('../src/engine/message');
const { LISTS } = require('../src/engine/url');
const { EMERGENCY, PREMIUM_RANGES } = require('../src/engine/phone');
const { URL_RE, PHONE_RE, STOPWORDS } = require('../src/engine/normalize');
const { BANK } = require('../src/training');
const { samples } = require('../src/engine/dataset');

const root = path.join(__dirname, '..', 'mobile');
const engine = new Engine();
const m = engine.model;
const none = () => null;

const data = {
  generatedAt: new Date().toISOString(),
  tactics: TACTICS,
  protective: PROTECTIVE,
  lists: LISTS,
  emergency: EMERGENCY,
  premiumRanges: PREMIUM_RANGES,
  urlRe: URL_RE.source,
  phoneRe: PHONE_RE.source,
  stopwords: [...STOPWORDS],
  model: {
    docs: m.docs, totals: m.totals, vocab: m.vocab.size,
    scam: Object.fromEntries(m.counts.scam), ham: Object.fromEntries(m.counts.ham),
  },
};
fs.mkdirSync(path.join(root, 'assets/offline'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets/offline/engine.json'), JSON.stringify(data));

const training = {};
for (const lang of Object.keys(BANK)) {
  training[lang] = BANK[lang].map((q, i) => {
    const a = engine.analyze({ type: 'auto', value: q.text }, none);
    return { id: `${lang}-${i}`, text: q.text, answer: q.scam ? 'scam' : 'safe', analysis: { score: a.score, level: a.level, reasons: a.reasons, entities: a.entities || [] } };
  });
}
fs.writeFileSync(path.join(root, 'assets/offline/training.json'), JSON.stringify(training));

const extra = [
  'https://adpolice-fines.com/pay', 'www.dubaipolice.gov.ae', 'http://emiratesnbd-secure.top/login', 'bit.ly/3xYz', 'paypa1.com',
  'login.uae-pay-fines.xyz/verify', 'https://www.google.com', '192.168.0.10/login', 'mysite.netlify.app/account',
  '+971501234567', '0501234567', '999', '800123', '+8821234567', '+447700900123', '042345678', '12',
  'هلا، وصلت البيت؟', 'Your verification code is 731904. Never share it with anyone', 'عطني الكود اللي وصلك ضروري',
  'شرطة أبوظبي: لديك مخالفة مرورية غير مدفوعة بقيمة 400 درهم، ادفع خلال 24 ساعة لتجنب حجز المركبة adpolice-fines.com/pay',
  'مرحبا، هذا رقمي الجديد اتصل علي +971551112233 بخصوص قضيه ضدك من الشرطة',
];
const inputs = [...extra, ...samples.map((s) => s.text), ...Object.values(BANK).flat().map((q) => q.text)];
const parity = [...new Set(inputs)].map((value) => {
  const r = engine.analyze({ type: 'auto', value }, none);
  return { value, type: r.detectedType, score: r.score, level: r.level, codes: r.reasons.map((x) => x.code) };
});
fs.mkdirSync(path.join(root, 'test/fixtures'), { recursive: true });
fs.writeFileSync(path.join(root, 'test/fixtures/parity.json'), JSON.stringify(parity, null, 1));
console.log(`engine.json, training.json, ${parity.length} parity cases`);
