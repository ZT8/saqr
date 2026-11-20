'use strict';
// Static, offline URL risk analysis. Saqr NEVER opens or fetches the link
// (that would leak the user's activity and could trigger malicious payloads);
// all checks are made on the URL string itself plus the community registry.

const { normalizeDigits } = require('./normalize');

const MULTI_SUFFIXES = new Set([
  'gov.ae', 'ac.ae', 'co.ae', 'net.ae', 'org.ae', 'sch.ae', 'mil.ae', 'pro.ae', 'name.ae',
  'co.uk', 'org.uk', 'com.sa', 'gov.sa', 'com.au', 'co.in', 'com.eg', 'com.qa', 'com.kw', 'com.bh', 'com.om',
]);

// Restricted namespaces that only governments can register.
const OFFICIAL_SUFFIXES = ['gov.ae', 'abudhabi', 'dubai'];

const TRUSTED_DOMAINS = new Set([
  'uaepass.ae', 'emiratesnbd.com', 'adcb.com', 'bankfab.com', 'mashreq.com', 'dib.ae', 'adib.ae', 'rakbank.ae', 'cbd.ae',
  'etisalat.ae', 'eand.com', 'du.ae', 'emiratespost.ae', 'aramex.com', 'dhl.com', 'emirates.com', 'etihad.com',
  'noon.com', 'amazon.ae', 'careem.com', 'talabat.com', 'google.com', 'apple.com', 'microsoft.com', 'whatsapp.com',
  'instagram.com', 'facebook.com', 'x.com', 'youtube.com', 'github.com', 'dewa.gov.ae', 'rta.ae', 'adpolice.gov.ae',
  'dubaipolice.gov.ae', 'moi.gov.ae', 'icp.gov.ae', 'tamm.abudhabi',
]);

// Brand names commonly impersonated (label part of the trusted domains + others).
const BRANDS = [
  'emiratesnbd', 'adcb', 'bankfab', 'mashreq', 'adib', 'rakbank', 'etisalat', 'emiratespost', 'aramex', 'dhl',
  'emirates', 'etihad', 'noon', 'amazon', 'careem', 'talabat', 'whatsapp', 'instagram', 'facebook', 'netflix', 'paypal',
  'apple', 'microsoft', 'google', 'salik', 'nol', 'dewa', 'addc', 'sewa', 'fewa', 'uaepass',
];

// Authority names — finding them outside an official domain is a strong phishing signal.
const AUTHORITIES = [
  'adpolice', 'dubaipolice', 'shjpolice', 'sharjahpolice', 'ajmanpolice', 'rakpolice', 'police', 'moi', 'icp', 'tamm',
  'rta', 'mohre', 'tdra', 'fta', 'smartdubai', 'uaepass', 'gdrfa', 'mofaic', 'customs', 'gov', 'govae',
];

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.ly', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 'goo.gl', 'ow.ly', 't.co', 'tiny.cc',
  'v.gd', 'rebrand.ly', 'bl.ink', 's.id', 'shorturl.asia', 'urlz.fr',
]);

const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'icu', 'click', 'live', 'shop', 'buzz', 'rest', 'cfd', 'sbs', 'monster', 'zip', 'mov', 'tk', 'ml', 'ga',
  'cf', 'gq', 'work', 'support', 'cam', 'quest', 'lol', 'bond', 'pw', 'vip', 'win', 'loan', 'online', 'site',
]);

const FREE_HOSTING = [
  'blogspot.com', 'weebly.com', 'wixsite.com', '000webhostapp.com', 'netlify.app', 'vercel.app', 'pages.dev', 'web.app',
  'firebaseapp.com', 'github.io', 'glitch.me', 'ngrok.io', 'ngrok-free.app', 'trycloudflare.com', 'duckdns.org',
  'repl.co', 'framer.website', 'webflow.io', 'carrd.co', 'square.site',
];

const PHISH_WORDS = [
  'login', 'signin', 'verify', 'verification', 'update', 'secure', 'account', 'wallet', 'payment', 'pay', 'fine',
  'fines', 'customs', 'tracking', 'otp', 'kyc', 'unlock', 'suspend', 'refund', 'reward', 'prize', 'bonus', 'claim',
];

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function deHomoglyph(s) {
  return s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e')
    .replace(/5/g, 's').replace(/4/g, 'a').replace(/7/g, 't').replace(/8/g, 'b');
}

function registrableDomain(host) {
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  return MULTI_SUFFIXES.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}

function isOfficial(host) {
  return OFFICIAL_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
}

function parseUrl(raw) {
  let s = normalizeDigits(String(raw).trim());
  const explicitScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
  if (!explicitScheme) s = 'http://' + s;
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return { url: u, explicitScheme };
  } catch {
    return null;
  }
}

/** Normalised registry key for a URL: lowercase host + path, without scheme, www, query or hash. */
function urlKey(raw) {
  const p = parseUrl(raw);
  if (!p) return String(raw).trim().toLowerCase();
  const host = p.url.hostname.replace(/^www\./, '');
  const path = p.url.pathname.replace(/\/+$/, '');
  return host + path;
}

function analyzeUrl(raw, registry = () => null) {
  const reasons = [];
  const add = (code, points, severity, params) => reasons.push({ code, points, severity, params });
  const parsed = parseUrl(raw);
  if (!parsed) {
    add('url_invalid', 20, 'medium');
    return finish(raw, null, reasons, registry);
  }
  const { url, explicitScheme } = parsed;
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const reg = registrableDomain(host);
  const regLabel = reg.split('.')[0];
  const official = isOfficial(host);
  const trusted = official || TRUSTED_DOMAINS.has(reg) || TRUSTED_DOMAINS.has(host);
  const tokens = host.split(/[.-]/).filter(Boolean);
  const subLabels = host.slice(0, Math.max(0, host.length - reg.length)).split('.').filter(Boolean);

  if (trusted) {
    add(official ? 'official_domain' : 'trusted_domain', -10, 'safe', { domain: reg });
    if (explicitScheme && url.protocol === 'http:') add('no_https', 10, 'low');
    return finish(raw, { host, reg }, reasons, registry, true);
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) add('ip_host', 30, 'high');
  if (host.split('.').some((l) => l.startsWith('xn--')) || /[^\x00-\x7f]/.test(raw)) add('punycode', 30, 'high');

  // Government impersonation: looks like gov.ae but is not.
  if (/(^|[.-])gov[.-]?ae([.-]|$)/.test(host) || /govae/.test(host) || subLabels.join('.').includes('gov.ae')) {
    add('gov_spoof', 45, 'high', { domain: reg });
  }

  // Authority / brand names used on an unofficial domain.
  const authHit = AUTHORITIES.find((a) => tokens.includes(a) || (a.length >= 6 && host.includes(a)));
  if (authHit && !reasons.some((r) => r.code === 'gov_spoof')) add('authority_unofficial', 45, 'high', { name: authHit, domain: reg });
  const brandHit = BRANDS.find((b) => tokens.includes(b) || (b.length >= 5 && host.includes(b)));
  if (brandHit) add('brand_unofficial', 40, 'high', { name: brandHit, domain: reg });

  // Typosquatting / homoglyphs against trusted brands.
  if (!brandHit) {
    const clean = deHomoglyph(regLabel);
    const look = BRANDS.filter((b) => b.length >= 4).find((b) => {
      if (clean === b && regLabel !== b) return true;
      const d = levenshtein(regLabel, b);
      return d > 0 && d <= (b.length >= 8 ? 2 : 1);
    });
    if (look) add('lookalike_domain', 60, 'high', { name: look, domain: reg });
  }

  const tld = host.split('.').pop();
  if (SUSPICIOUS_TLDS.has(tld)) add('suspicious_tld', 18, 'medium', { tld });
  if (SHORTENERS.has(host)) add('shortener', 25, 'medium', { domain: host });
  if (FREE_HOSTING.some((f) => host === f || host.endsWith('.' + f))) add('free_hosting', 20, 'medium', { domain: reg });
  if (explicitScheme && url.protocol === 'http:') add('no_https', 10, 'low');
  if (url.username || /@/.test(String(raw).replace(/^[a-z]+:\/\//i, '').split('/')[0])) add('at_symbol', 25, 'high');
  if (subLabels.length >= 3) add('many_subdomains', 10, 'low', { count: subLabels.length });
  if ((host.match(/-/g) || []).length >= 3) add('many_hyphens', 8, 'low');
  if (String(raw).length > 100) add('long_url', 5, 'low');
  if (url.port && !['80', '443'].includes(url.port)) add('odd_port', 10, 'low', { port: url.port });

  const full = (host + url.pathname + url.search).toLowerCase();
  const words = PHISH_WORDS.filter((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(full));
  if (words.length) add('phish_words', Math.min(20, words.length * 7), words.length > 1 ? 'medium' : 'low', { terms: words.slice(0, 4) });

  return finish(raw, { host, reg }, reasons, registry);
}

function finish(raw, info, reasons, registry, trusted = false) {
  const key = urlKey(raw);
  // Check the full URL first, then the bare domain (a verified bad domain taints every path on it).
  const hit = registry('url', key) || (info ? registry('url', info.host) || registry('url', info.reg) : null);
  let score = reasons.reduce((s, r) => s + r.points, trusted ? 5 : 8);
  if (hit && hit.status === 'verified') {
    reasons.unshift({ code: 'registry_verified', points: 0, severity: 'high', params: { reports: hit.report_count } });
    score = Math.max(score, 95);
  } else if (hit && hit.status === 'pending' && hit.report_count > 0) {
    reasons.unshift({ code: 'registry_reported', points: 0, severity: 'medium', params: { reports: hit.report_count } });
    score += Math.min(40, 12 * hit.report_count);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { type: 'url', input: String(raw), key, host: info?.host || null, domain: info?.reg || null, score, reasons };
}

module.exports = { analyzeUrl, urlKey, registrableDomain, levenshtein };
