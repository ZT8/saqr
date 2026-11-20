'use strict';
// Threat feeds: public lists of phishing/scam links (and any list the authority uploads,
// e.g. scam numbers from a telecom operator). Entries are matched exactly by host or
// host+path, never by parent domain, so a phishing page on a shared host does not taint
// the whole service (e.g. one bad Google Sites page must not flag google.com).

const { urlKey, registrableDomain, isTrustedHost } = require('./engine/url');
const { normalizePhone } = require('./engine/phone');

// Built-in sources. Each is free to download; check each provider's terms before production use.
const BUILTIN = [
  {
    id: 'phishing-database', name: 'Phishing.Database (active phishing domains)', type: 'url', format: 'lines',
    url: 'https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt',
    license: 'MIT — github.com/mitchellkrogza/Phishing.Database',
  },
  {
    id: 'openphish', name: 'OpenPhish community feed (phishing URLs)', type: 'url', format: 'lines',
    url: 'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt',
    license: 'OpenPhish community feed terms — openphish.com',
  },
  {
    id: 'urlhaus', name: 'URLhaus by abuse.ch (malware URLs, online)', type: 'url', format: 'lines',
    url: 'https://urlhaus.abuse.ch/downloads/text_online/',
    license: 'CC0 — urlhaus.abuse.ch',
  },
];

const MAX_LINE = 2048;

/** Normalise one list line into a lookup key, or null to skip it. */
function toKey(type, line) {
  let v = String(line || '').trim();
  if (!v || v.startsWith('#') || v.startsWith('//') || v.length > MAX_LINE) return null;
  if (v.includes(',')) v = v.split(',')[0].trim().replace(/^"|"$/g, ''); // CSV: first column
  if (!v) return null;
  if (type === 'phone') {
    const n = normalizePhone(v);
    return n.e164 && n.digits.length >= 7 ? n.e164 : null;
  }
  // URL or bare domain
  const key = urlKey(v);
  if (!key || !/^[a-z0-9.-]+\.[a-z]{2,}/i.test(key)) return null;
  const host = key.split('/')[0];
  // Shared/trusted platforms: only keep entries with a specific path.
  if (isTrustedHost(host) && !key.includes('/')) return null;
  return key.toLowerCase();
}

function makeFeeds(db, { fetchImpl } = {}) {
  const nowIso = () => new Date().toISOString();
  const ins = db.prepare('INSERT OR IGNORE INTO feed_indicators (type, value, source) VALUES (?, ?, ?)');
  const find = db.prepare(`SELECT fi.source, fs.name FROM feed_indicators fi JOIN feed_sources fs ON fs.id = fi.source
                           WHERE fi.type = ? AND fi.value = ? AND fs.enabled = 1 LIMIT 1`);

  // Register built-in sources once.
  const reg = db.prepare(`INSERT OR IGNORE INTO feed_sources (id, name, url, type, format, license, builtin) VALUES (@id, @name, @url, @type, @format, @license, 1)`);
  for (const s of BUILTIN) reg.run(s);

  const replaceEntries = db.transaction((source, type, lines) => {
    db.prepare('DELETE FROM feed_indicators WHERE source = ?').run(source);
    let n = 0;
    for (const line of lines) {
      const k = toKey(type, line);
      if (k && ins.run(type, k, source).changes) n++;
    }
    db.prepare('UPDATE feed_sources SET count = ?, last_run = ?, last_status = ? WHERE id = ?').run(n, nowIso(), 'ok', source);
    return n;
  });

  async function getFetch() {
    if (fetchImpl) return fetchImpl;
    try {
      // Honour HTTPS_PROXY / NO_PROXY when set (corporate networks).
      const { fetch, EnvHttpProxyAgent } = require('undici');
      const dispatcher = process.env.HTTPS_PROXY || process.env.https_proxy ? new EnvHttpProxyAgent() : undefined;
      return (url, opts = {}) => fetch(url, { ...opts, dispatcher });
    } catch {
      return globalThis.fetch;
    }
  }

  async function update(id) {
    const src = db.prepare('SELECT * FROM feed_sources WHERE id = ?').get(id);
    if (!src) throw Object.assign(new Error('not_found'), { code: 'not_found', status: 404 });
    if (!src.url) throw Object.assign(new Error('no_url'), { code: 'no_url', status: 400 });
    const f = await getFetch();
    try {
      const res = await f(src.url, { headers: { 'User-Agent': 'Saqr/1.0 (+anti-fraud prototype)' }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const n = replaceEntries(src.id, src.type, text.split(/\r?\n/));
      return { id, count: n };
    } catch (e) {
      db.prepare('UPDATE feed_sources SET last_run = ?, last_status = ? WHERE id = ?').run(nowIso(), 'error: ' + String(e.message).slice(0, 120), id);
      throw Object.assign(new Error('feed_failed'), { code: 'feed_failed', status: 502, detail: e.message });
    }
  }

  async function updateAll() {
    const out = [];
    for (const s of db.prepare('SELECT id FROM feed_sources WHERE enabled = 1 AND url IS NOT NULL').all()) {
      try { out.push(await update(s.id)); } catch (e) { out.push({ id: s.id, error: e.detail || e.code }); }
    }
    return out;
  }

  /** An uploaded list (e.g. scam numbers from a telecom operator) becomes its own source. */
  function upload({ name, type, text }) {
    if (!['url', 'phone'].includes(type)) throw Object.assign(new Error('invalid_type'), { code: 'invalid_type', status: 400 });
    const label = String(name || '').trim().slice(0, 80);
    if (!label) throw Object.assign(new Error('name_required'), { code: 'name_required', status: 400 });
    const lines = String(text || '').split(/\r?\n/).slice(0, 200000);
    const id = 'upload-' + label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
    db.prepare(`INSERT INTO feed_sources (id, name, url, type, format, license, builtin) VALUES (?, ?, NULL, ?, 'lines', 'uploaded', 0)
                ON CONFLICT(id) DO UPDATE SET name = excluded.name, type = excluded.type`).run(id, label, type);
    const count = replaceEntries(id, type, lines);
    return { id, count };
  }

  function setEnabled(id, enabled) {
    const r = db.prepare('UPDATE feed_sources SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
    if (!r.changes) throw Object.assign(new Error('not_found'), { code: 'not_found', status: 404 });
    return { id, enabled: !!enabled };
  }

  function remove(id) {
    const s = db.prepare('SELECT builtin FROM feed_sources WHERE id = ?').get(id);
    if (!s) throw Object.assign(new Error('not_found'), { code: 'not_found', status: 404 });
    if (s.builtin) {
      db.prepare('DELETE FROM feed_indicators WHERE source = ?').run(id);
      db.prepare("UPDATE feed_sources SET count = 0, enabled = 0, last_status = 'cleared' WHERE id = ?").run(id);
    } else {
      db.prepare('DELETE FROM feed_sources WHERE id = ?').run(id);
    }
    return { ok: true };
  }

  function list() {
    return db.prepare('SELECT id, name, url, type, license, enabled, builtin, last_run, last_status, count FROM feed_sources ORDER BY builtin DESC, name').all();
  }

  /** Exact lookup used by the engine's registry callback. */
  function lookup(type, value) {
    const row = find.get(type, String(value).toLowerCase());
    return row ? { source: row.source, name: row.name } : null;
  }

  return { update, updateAll, upload, setEnabled, remove, list, lookup, BUILTIN };
}

module.exports = { makeFeeds, toKey, BUILTIN };
