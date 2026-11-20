'use strict';
// Privacy: remove the *victim's* personal data from report text before it is stored.
// Scammer indicators (their links and phone numbers) are kept, because they are the evidence.

const { normalizeDigits } = require('./normalize');

function luhn(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = +num[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const RULES = [
  ['email', /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[EMAIL]'],
  ['emirates_id', /\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b/g, '[EMIRATES_ID]'],
  ['iban', /\bAE\d{2}\s?(?:\d{4}\s?){4}\d{3}\b/gi, '[IBAN]'],
  ['card', /\b(?:\d[ -]?){13,19}\b/g, '[CARD]', (m) => luhn(m.replace(/\D/g, ''))],
  ['otp', /((?:otp|code|رمز|كود|الرمز)[^\d\n]{0,15})\d{4,8}\b/gi, '$1[CODE]'],
  ['passport', /\b(?:passport|جواز)[^\w\n]{0,12}[A-Z0-9]{6,9}\b/gi, '[PASSPORT]'],
];

function redact(text) {
  let out = normalizeDigits(String(text || ''));
  const counts = {};
  for (const [name, re, repl, check] of RULES) {
    out = out.replace(re, (...args) => {
      const m = args[0];
      if (check && !check(m)) return m;
      counts[name] = (counts[name] || 0) + 1;
      return m.replace(new RegExp(re.source, re.flags.replace('g', '')), repl);
    });
  }
  return { text: out, redactions: counts };
}

module.exports = { redact };
