'use strict';
// Phone number analysis: normalisation to E.164, UAE numbering-plan checks,
// high-risk international ranges, and community-registry lookups.

const { normalizeDigits } = require('./normalize');

const EMERGENCY = { '999': 'police', '998': 'ambulance', '997': 'civil_defence', '996': 'coast_guard' };
// International ranges frequently abused for premium-rate / "wangiri" missed-call fraud.
const PREMIUM_RANGES = ['882', '883', '881', '979', '870', '808'];

function normalizePhone(raw) {
  let s = normalizeDigits(String(raw)).trim();
  const plus = s.startsWith('+');
  let d = s.replace(/\D/g, '');
  if (!d) return { e164: null, digits: '' };
  if (EMERGENCY[d] || /^(800|600)\d{3,7}$/.test(d)) return { e164: d, digits: d, local: true };
  if (!plus && d.startsWith('00')) d = d.slice(2);
  else if (!plus && d.startsWith('0') && (d.length === 10 || d.length === 9)) d = '971' + d.slice(1); // 05X XXX XXXX / 0X XXX XXXX
  else if (!plus && d.length === 9 && /^5/.test(d)) d = '971' + d; // 5X XXX XXXX
  return { e164: '+' + d, digits: d };
}

function analyzePhone(raw, registry = () => null) {
  const reasons = [];
  const add = (code, points, severity, params) => reasons.push({ code, points, severity, params });
  const n = normalizePhone(raw);
  let kind = 'invalid';
  let score = 8;

  if (!n.e164) {
    add('phone_invalid', 25, 'medium');
  } else if (n.local && EMERGENCY[n.digits]) {
    kind = 'emergency';
    add('official_emergency', -8, 'safe', { service: EMERGENCY[n.digits] });
  } else if (n.local) {
    kind = n.digits.startsWith('800') ? 'uae_tollfree' : 'uae_600';
    add('uae_service_number', -3, 'safe');
  } else if (n.digits.startsWith('971')) {
    const rest = n.digits.slice(3);
    if (/^5[024568]\d{7}$/.test(rest)) {
      kind = 'uae_mobile';
      add('uae_mobile', 0, 'info');
    } else if (/^[234679]\d{7}$/.test(rest)) {
      kind = 'uae_landline';
      add('uae_landline', -3, 'info');
    } else {
      kind = 'invalid';
      add('phone_invalid', 25, 'medium');
    }
  } else {
    kind = 'international';
    const premium = PREMIUM_RANGES.find((p) => n.digits.startsWith(p));
    if (premium) add('premium_range', 50, 'high', { prefix: '+' + premium });
    else add('international', 18, 'medium', { prefix: '+' + n.digits.slice(0, 3) });
    if (n.digits.length < 8 || n.digits.length > 15) add('phone_invalid', 20, 'medium');
  }

  const hit = n.e164 ? registry('phone', n.e164) : null;
  score += reasons.reduce((s, r) => s + r.points, 0);
  if (hit && hit.status === 'verified') {
    reasons.unshift({ code: 'registry_verified', points: 0, severity: 'high', params: { reports: hit.report_count } });
    score = Math.max(score, 95);
  } else if (hit && hit.status === 'pending' && hit.report_count > 0) {
    reasons.unshift({ code: 'registry_reported', points: 0, severity: 'medium', params: { reports: hit.report_count } });
    score += Math.min(45, 15 * hit.report_count);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { type: 'phone', input: String(raw), key: n.e164 || String(raw).trim(), kind, score, reasons };
}

module.exports = { analyzePhone, normalizePhone };
