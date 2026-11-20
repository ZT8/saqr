'use strict';
// Saqr detection engine — single entry point.

const { NaiveBayes } = require('./classifier');
const { samples } = require('./dataset');
const { analyzeMessage } = require('./message');
const { analyzeUrl, urlKey } = require('./url');
const { analyzePhone, normalizePhone } = require('./phone');
const { redact } = require('./redact');
const { normalizeDigits } = require('./normalize');

const LEVELS = [
  { max: 29, level: 'safe' },
  { max: 64, level: 'suspicious' },
  { max: 100, level: 'dangerous' },
];
const levelOf = (score) => LEVELS.find((l) => score <= l.max).level;

const ADVICE = {
  safe: ['advice_stay_alert', 'advice_official_channels'],
  suspicious: ['advice_dont_click', 'advice_verify_official', 'advice_never_share_otp', 'advice_report'],
  dangerous: ['advice_dont_click', 'advice_never_share_otp', 'advice_block', 'advice_report', 'advice_if_paid'],
};

class Engine {
  constructor() {
    this.model = new NaiveBayes();
    this.extraSamples = [];
    this.retrain();
  }

  /** Add community-verified samples (learning loop) and retrain. */
  retrain(extra) {
    if (extra) this.extraSamples = extra;
    this.model.train([...samples, ...this.extraSamples]);
    this.retrainInfo = { samples: samples.length + this.extraSamples.length, vocabulary: this.model.vocab.size, trainedAt: new Date().toISOString() };
    return this.retrainInfo;
  }

  detectType(value) {
    const v = normalizeDigits(String(value || '')).trim();
    if (/^\+?[\d\s()-]{3,20}$/.test(v) && v.replace(/\D/g, '').length >= 3) return 'phone';
    if (!/\s/.test(v) && (/^[a-z]+:\/\//i.test(v) || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(v))) return 'url';
    return 'message';
  }

  analyze({ type = 'auto', value }, registry = () => null) {
    const v = String(value || '').slice(0, 5000);
    const t = type === 'auto' ? this.detectType(v) : type;
    let r;
    if (t === 'url') r = analyzeUrl(v.trim(), registry);
    else if (t === 'phone') r = analyzePhone(v, registry);
    else r = analyzeMessage(v, { model: this.model, registry });
    const level = levelOf(r.score);
    // Strip internal point weights from the public response; keep code/severity/params.
    const clean = (res) => ({
      ...res,
      level: levelOf(res.score),
      reasons: res.reasons.map(({ code, severity, params }) => ({ code, severity, params: params || {} })),
      ...(res.entities ? { entities: res.entities.map(clean) } : {}),
    });
    return { ...clean(r), detectedType: t, level, advice: ADVICE[level] };
  }
}

/** Registry key for a reported indicator, by type. */
function indicatorKey(type, value) {
  if (type === 'url') return urlKey(value);
  if (type === 'phone') return normalizePhone(value).e164 || String(value).trim();
  return null;
}

module.exports = { Engine, indicatorKey, redact, levelOf };
