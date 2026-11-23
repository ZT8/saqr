'use strict';
// Leave-one-out evaluation of the detection engine on the bilingual dataset.
// Each message is scored by an engine whose classifier never saw that message, so the numbers
// estimate performance on new messages written in the same styles. Run: npm run evaluate
const { Engine } = require('../src/engine');
const { samples } = require('../src/engine/dataset');
const { BANK } = require('../src/training');

const none = () => null;
const engine = new Engine();
function evaluate(set, { loo }) {
  const m = { tp: 0, fp: 0, tn: 0, fn: 0, flaggedDangerous: 0, misses: [] };
  set.forEach((s, i) => {
    if (loo) engine.model.train(set.filter((_, j) => j !== i).map((x) => ({ text: x.text, label: x.label })));
    const r = engine.analyze({ type: 'message', value: s.text }, none);
    const flagged = r.score >= 30; // suspicious or dangerous
    const scam = s.label === 'scam';
    if (scam && flagged) m.tp++;
    else if (scam) { m.fn++; m.misses.push(`missed  ${r.score}  ${s.text.slice(0, 70)}`); }
    else if (flagged) { m.fp++; m.misses.push(`false+  ${r.score}  ${s.text.slice(0, 70)}`); }
    else m.tn++;
    if (scam && r.level === 'dangerous') m.flaggedDangerous++;
  });
  const p = m.tp / (m.tp + m.fp || 1);
  const rec = m.tp / (m.tp + m.fn || 1);
  return { ...m, n: set.length, precision: p, recall: rec, f1: (2 * p * rec) / (p + rec || 1), accuracy: (m.tp + m.tn) / set.length };
}
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const show = (name, r) => {
  console.log(`\n${name} (n=${r.n}, scams=${r.tp + r.fn}, normal=${r.tn + r.fp})`);
  console.log(`  precision ${pct(r.precision)}  recall ${pct(r.recall)}  F1 ${pct(r.f1)}  accuracy ${pct(r.accuracy)}`);
  console.log(`  TP ${r.tp}  FN ${r.fn}  TN ${r.tn}  FP ${r.fp}  scams rated dangerous: ${r.flaggedDangerous}`);
  r.misses.forEach((x) => console.log('   ', x));
};
show('Dataset, leave-one-out', evaluate(samples, { loo: true }));
engine.model.train(samples);
const practice = Object.values(BANK).flat().map((q) => ({ text: q.text, label: q.scam ? 'scam' : 'ham' }));
show('Practice bank (held out: not in the training set)', evaluate(practice, { loo: false }));
