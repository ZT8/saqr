'use strict';
// Text normalisation shared by the classifier, rules and extractors.
// Arabic is normalised so spelling variants (أ/إ/ا, ة/ه, ى/ي, diacritics, tatweel)
// collapse to one form, and Arabic-Indic digits become ASCII digits.

const AR_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;

function normalizeDigits(s) {
  return String(s)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
}

function normalizeArabic(s) {
  return s
    .replace(AR_DIACRITICS, '')
    .replace(/ـ/g, '') // tatweel
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

function normalizeText(s) {
  return normalizeArabic(normalizeDigits(s)).toLowerCase();
}

const TLD_HINT =
  'com|net|org|info|xyz|top|ae|io|co|me|ly|gd|cc|shop|site|online|live|click|icu|link|app|biz|us|uk|sa|qa|vip|cfd|sbs|buzz|rest|monster|tk|ml|ga|cf|gq|work|support|store|club|abudhabi|dubai|pw|cn|ru|in';

// URLs with a scheme or www., or bare domains with a known TLD.
const URL_RE = new RegExp(
  `(?<![\\w@.-])((?:https?:\\/\\/|www\\.)[^\\s<>"'،]+|(?:[a-z0-9-]+\\.)+(?:${TLD_HINT})(?::\\d+)?(?:\\/[^\\s<>"'،]*)?)(?![\\w-])`,
  'gi'
);

// Phone-like sequences: optional + or 00, then 8+ digits possibly separated by spaces/dashes.
const PHONE_RE = /(?<![\w\d])(?:\+|00)?\d[\d\s-]{6,17}\d(?![\d])/g;

function stripTrailingPunct(u) {
  return u.replace(/[).,!?؛؟]+$/u, '');
}

function extractUrls(text) {
  const t = normalizeDigits(String(text));
  const out = new Set();
  for (const m of t.matchAll(URL_RE)) out.add(stripTrailingPunct(m[1]));
  return [...out];
}

function extractPhones(text) {
  // Remove URLs first so digits inside links are not read as phone numbers.
  const t = normalizeDigits(String(text)).replace(URL_RE, ' ');
  const out = new Set();
  for (const m of t.matchAll(PHONE_RE)) {
    const raw = m[0].trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) continue;
    if (/^784\d{12}$/.test(digits)) continue; // Emirates ID, not a phone
    out.add(raw);
  }
  return [...out];
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'and', 'or', 'is', 'are', 'in', 'on', 'for', 'at', 'this', 'that', 'it', 'be', 'with', 'by', 'as',
  'في', 'من', 'الي', 'علي', 'عن', 'ان', 'هذا', 'هذه', 'و', 'او', 'مع', 'ما', 'هو', 'هي', 'كان', 'ثم', 'لا', 'يا',
]);

function tokenize(text) {
  let t = normalizeText(text);
  t = t.replace(URL_RE, ' __url__ ');
  t = t.replace(PHONE_RE, ' __phone__ ');
  t = t.replace(/\d+/g, ' __num__ ');
  const words = t.split(/[^\p{L}\p{N}_]+/u).filter((w) => w && w.length > 1 && !STOPWORDS.has(w));
  const tokens = [...words];
  for (let i = 0; i < words.length - 1; i++) tokens.push(words[i] + '_' + words[i + 1]);
  return tokens;
}

module.exports = { normalizeText, normalizeDigits, normalizeArabic, tokenize, extractUrls, extractPhones, URL_RE };
