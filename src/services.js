'use strict';
// Business logic shared by the HTTP routes and the demo seeder.

const crypto = require('crypto');
const { indicatorKey, redact } = require('./engine');
const { extractUrls, extractPhones, normalizeText } = require('./engine/normalize');

const CATEGORIES = ['fake_fine', 'bank_otp', 'parcel', 'prize', 'investment', 'job', 'impersonation', 'family_emergency', 'shopping', 'other'];
const CHANNELS = ['sms', 'whatsapp', 'call', 'email', 'social', 'website', 'other'];
const EMIRATES = ['abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah'];
const TYPES = ['message', 'url', 'phone'];

const nowIso = () => new Date().toISOString();
const dayOf = (iso) => iso.slice(0, 10);

class ValidationError extends Error {
  constructor(code) { super(code); this.code = code; this.status = 400; }
}

function messageFingerprint(text) {
  const t = normalizeText(text).replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
  return 'msg:' + crypto.createHash('sha256').update(t).digest('hex').slice(0, 24);
}

function mask(type, value) {
  if (type === 'phone') return value.length > 7 ? value.slice(0, 6) + '•••' + value.slice(-3) : '•••';
  if (type === 'url') {
    const host = value.split('/')[0];
    if (host.length <= 6) return host[0] + '•••';
    return host.slice(0, 3) + '•••' + host.slice(-7);
  }
  return '•••';
}

function makeServices(db, engine, config) {
  const q = {
    findInd: db.prepare('SELECT * FROM indicators WHERE type = ? AND value = ?'),
    insInd: db.prepare(`INSERT INTO indicators (type, value, category, status, report_count, risk_score, first_seen, last_seen)
                        VALUES (@type, @value, @category, 'pending', 0, @risk, @now, @now)`),
    bumpInd: db.prepare('UPDATE indicators SET report_count = report_count + 1, last_seen = MAX(last_seen, ?), category = COALESCE(category, ?) WHERE id = ?'),
    insReport: db.prepare(`INSERT INTO reports (indicator_id, category, channel, emirate, content, amount_lost, reporter_hash, created_at)
                           VALUES (@indicator_id, @category, @channel, @emirate, @content, @amount_lost, @reporter_hash, @created_at)`),
    linkRI: db.prepare('INSERT OR IGNORE INTO report_indicators (report_id, indicator_id) VALUES (?, ?)'),
    dupe: db.prepare(`SELECT 1 FROM report_indicators ri JOIN reports r ON r.id = ri.report_id
                      WHERE ri.indicator_id = ? AND r.reporter_hash = ? AND substr(r.created_at,1,10) = ? LIMIT 1`),
    scanStat: db.prepare(`INSERT INTO scan_stats (day, type, level, count) VALUES (?, ?, ?, 1)
                          ON CONFLICT(day, type, level) DO UPDATE SET count = count + 1`),
  };

  function reporterHash(ip, when = nowIso()) {
    return crypto.createHmac('sha256', config.hashSecret).update(`${ip}|${dayOf(when)}`).digest('hex').slice(0, 32);
  }

  let feedLookup = null;
  /**
   * Registry lookup used by the engine. Community registry first (rejected entries ignored),
   * then external threat feeds — exact matches only (scope 'parent' never consults feeds).
   */
  function registry(type, value, scope = 'exact') {
    const row = q.findInd.get(type, value);
    if (row && row.status !== 'rejected') return { status: row.status, report_count: row.report_count };
    if (feedLookup && scope !== 'parent') {
      const f = feedLookup(type, value);
      if (f) return { status: 'feed', name: f.name, source: f.source };
    }
    return null;
  }
  const setFeedLookup = (fn) => { feedLookup = fn; };

  function scan(type, value) {
    const result = engine.analyze({ type, value }, registry);
    q.scanStat.run(dayOf(nowIso()), result.detectedType, result.level);
    return result;
  }

  function upsertIndicator(type, value, category, risk, when) {
    let row = q.findInd.get(type, value);
    if (!row) {
      q.insInd.run({ type, value, category, risk, now: when });
      row = q.findInd.get(type, value);
    }
    return row;
  }

  const createReport = db.transaction((input, { ip = '0.0.0.0', when = nowIso(), hash } = {}) => {
    const type = input.type;
    const raw = String(input.value || '').trim();
    if (!TYPES.includes(type)) throw new ValidationError('invalid_type');
    const MAX = { message: 5000, url: 2048, phone: 32 };
    if (raw.length < 3 || raw.length > MAX[type]) throw new ValidationError('invalid_value');
    if (!CATEGORIES.includes(input.category)) throw new ValidationError('invalid_category');
    if (!CHANNELS.includes(input.channel)) throw new ValidationError('invalid_channel');
    if (input.emirate && !EMIRATES.includes(input.emirate)) throw new ValidationError('invalid_emirate');
    const amount = input.amount_lost === undefined || input.amount_lost === '' || input.amount_lost === null ? null : Number(input.amount_lost);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1e8)) throw new ValidationError('invalid_amount');

    const reporter = hash || reporterHash(ip, when);
    const analysis = engine.analyze({ type, value: raw }, registry);

    // Build the list of indicators this report touches.
    const targets = [];
    let content = null;
    if (type === 'message') {
      content = redact(raw).text;
      targets.push(['message', messageFingerprint(raw), analysis.score]);
      for (const u of extractUrls(raw)) targets.push(['url', indicatorKey('url', u), null]);
      for (const p of extractPhones(raw)) targets.push(['phone', indicatorKey('phone', p), null]);
    } else {
      targets.push([type, indicatorKey(type, raw), analysis.score]);
      if (input.description) content = redact(String(input.description).slice(0, 1000)).text;
    }

    const rows = targets.map(([t, v, s]) => upsertIndicator(t, v, input.category, s ?? engine.analyze({ type: t, value: v }, registry).score, when));
    if (rows.every((r) => q.dupe.get(r.id, reporter, dayOf(when)))) {
      const err = new ValidationError('already_reported');
      err.status = 409;
      throw err;
    }
    const info = q.insReport.run({
      indicator_id: rows[0].id, category: input.category, channel: input.channel, emirate: input.emirate || null,
      content, amount_lost: amount, reporter_hash: reporter, created_at: when,
    });
    for (const r of rows) {
      if (q.dupe.get(r.id, reporter, dayOf(when))) continue; // one vote per reporter per day per indicator
      q.linkRI.run(info.lastInsertRowid, r.id);
      q.bumpInd.run(when, input.category, r.id);
    }
    return {
      id: Number(info.lastInsertRowid),
      indicators: rows.map((r) => ({ type: r.type, status: r.status })),
      redacted: type === 'message' ? content !== raw : false,
      analysis: { score: analysis.score, level: analysis.level },
    };
  });

  function learnedSamples() {
    return db.prepare('SELECT text, label FROM learned_samples').all();
  }

  function retrain() {
    return engine.retrain(learnedSamples());
  }

  const setStatus = db.transaction((id, status, admin) => {
    if (!['verified', 'rejected', 'pending'].includes(status)) throw new ValidationError('invalid_status');
    const ind = db.prepare('SELECT * FROM indicators WHERE id = ?').get(id);
    if (!ind) { const e = new ValidationError('not_found'); e.status = 404; throw e; }
    db.prepare('UPDATE indicators SET status = ?, reviewed_at = ? WHERE id = ?').run(status, nowIso(), id);
    db.prepare('INSERT INTO audit_log (admin, action, target, created_at) VALUES (?, ?, ?, ?)')
      .run(admin, 'set_status:' + status, `${ind.type}:${ind.value}`, nowIso());
    let learned = false;
    // Learning loop: reviewed message reports become new training samples.
    if (ind.type === 'message' && status !== 'pending') {
      const rep = db.prepare('SELECT content FROM reports WHERE indicator_id = ? AND content IS NOT NULL ORDER BY created_at DESC LIMIT 1').get(id);
      if (rep) {
        db.prepare('DELETE FROM learned_samples WHERE source_indicator = ?').run(id);
        db.prepare('INSERT INTO learned_samples (text, label, source_indicator, created_at) VALUES (?, ?, ?, ?)')
          .run(rep.content, status === 'verified' ? 'scam' : 'ham', id, nowIso());
        learned = true;
      }
    } else if (ind.type === 'message' && status === 'pending') {
      db.prepare('DELETE FROM learned_samples WHERE source_indicator = ?').run(id);
      learned = true;
    }
    return { id, status, learned };
  });

  function latestContent(indId) {
    const r = db.prepare('SELECT content FROM reports WHERE indicator_id = ? AND content IS NOT NULL ORDER BY created_at DESC LIMIT 1').get(indId);
    return r ? r.content : null;
  }

  function publicRegistry({ q: search = '', type = '', page = 1, pageSize = 20 }) {
    const where = [`(status = 'verified' OR (status = 'pending' AND report_count >= ${Number(config.publicThreshold)}))`];
    const params = {};
    if (TYPES.includes(type)) { where.push('type = @type'); params.type = type; }
    let rows = db.prepare(`SELECT id, type, value, category, status, report_count, last_seen FROM indicators
                           WHERE ${where.join(' AND ')} ORDER BY (status='verified') DESC, report_count DESC, last_seen DESC`).all(params);
    if (search) {
      const s = String(search).trim().toLowerCase();
      const phoneKey = indicatorKey('phone', s);
      const urlKey = indicatorKey('url', s);
      // Pending (unverified) entries match only on an exact lookup so partial masking cannot be bypassed.
      rows = rows.filter((r) => r.status === 'verified'
        ? r.value.toLowerCase().includes(s) || r.value === phoneKey || r.value === urlKey
        : r.value === phoneKey || r.value === urlKey);
    }
    const total = rows.length;
    const items = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status === 'verified' ? 'verified' : 'reported',
      value: r.type === 'message' ? null : r.status === 'verified' ? r.value : mask(r.type, r.value),
      sample: r.type === 'message' && r.status === 'verified' ? (latestContent(r.id) || '').slice(0, 280) : null,
      category: r.category,
      reports: r.report_count,
      last_seen: r.last_seen,
    }));
    return { total, page, pageSize, items };
  }

  function publicStats() {
    const one = (sql) => Object.values(db.prepare(sql).get())[0] || 0;
    return {
      verified: one("SELECT COUNT(*) FROM indicators WHERE status = 'verified'"),
      reports: one('SELECT COUNT(*) FROM reports'),
      scans: one('SELECT COALESCE(SUM(count),0) FROM scan_stats'),
      blockedThisMonth: one(`SELECT COUNT(*) FROM indicators WHERE status='verified' AND reviewed_at >= date('now','-30 day')`),
      byCategory: Object.fromEntries(db.prepare("SELECT category k, COUNT(*) c FROM reports WHERE created_at >= date('now','-30 day') GROUP BY category").all().map((r) => [r.k, r.c])),
    };
  }

  function adminStats(days = 30) {
    const since = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
    const all = (sql, ...p) => db.prepare(sql).all(...p);
    const one = (sql, ...p) => Object.values(db.prepare(sql).get(...p))[0] || 0;
    const dailyReports = Object.fromEntries(all(`SELECT substr(created_at,1,10) d, COUNT(*) c FROM reports WHERE substr(created_at,1,10) >= ? GROUP BY d`, since).map((r) => [r.d, r.c]));
    const dailyScans = Object.fromEntries(all(`SELECT day d, SUM(count) c FROM scan_stats WHERE day >= ? GROUP BY day`, since).map((r) => [r.d, r.c]));
    const daily = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.parse(since) + i * 864e5).toISOString().slice(0, 10);
      daily.push({ day: d, reports: dailyReports[d] || 0, scans: dailyScans[d] || 0 });
    }
    const last7 = daily.slice(-7).reduce((s, d) => s + d.reports, 0);
    const prev7 = daily.slice(-14, -7).reduce((s, d) => s + d.reports, 0);
    return {
      totals: {
        reports: one('SELECT COUNT(*) FROM reports'),
        pending: one("SELECT COUNT(*) FROM indicators WHERE status='pending'"),
        verified: one("SELECT COUNT(*) FROM indicators WHERE status='verified'"),
        rejected: one("SELECT COUNT(*) FROM indicators WHERE status='rejected'"),
        scans: one('SELECT COALESCE(SUM(count),0) FROM scan_stats'),
        dangerousScans: one("SELECT COALESCE(SUM(count),0) FROM scan_stats WHERE level='dangerous'"),
        amountLost: one('SELECT COALESCE(SUM(amount_lost),0) FROM reports'),
        last7, prev7,
      },
      daily,
      byCategory: all('SELECT category k, COUNT(*) c FROM reports GROUP BY category ORDER BY c DESC'),
      byChannel: all('SELECT channel k, COUNT(*) c FROM reports GROUP BY channel ORDER BY c DESC'),
      byEmirate: all("SELECT COALESCE(emirate,'unknown') k, COUNT(*) c FROM reports GROUP BY k ORDER BY c DESC"),
      byType: all('SELECT type k, COUNT(*) c FROM indicators GROUP BY type ORDER BY c DESC'),
      model: { ...engine.retrainInfo, learned: one('SELECT COUNT(*) FROM learned_samples') },
      openCases: one("SELECT COUNT(*) FROM cases WHERE status != 'closed'"),
    };
  }

  function adminIndicators({ status = 'pending', type = '', q: search = '', page = 1, pageSize = 15 }) {
    const where = [];
    const params = {};
    if (['pending', 'verified', 'rejected'].includes(status)) { where.push('status = @status'); params.status = status; }
    if (TYPES.includes(type)) { where.push('type = @type'); params.type = type; }
    if (search) { where.push('value LIKE @q'); params.q = `%${search}%`; }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) c FROM indicators ${w}`).get(params).c;
    const rows = db.prepare(`SELECT * FROM indicators ${w} ORDER BY report_count DESC, last_seen DESC LIMIT @lim OFFSET @off`)
      .all({ ...params, lim: pageSize, off: (page - 1) * pageSize });
    const repQ = db.prepare(`SELECT r.id, r.category, r.channel, r.emirate, r.content, r.amount_lost, r.created_at
                             FROM reports r JOIN report_indicators ri ON ri.report_id = r.id
                             WHERE ri.indicator_id = ? ORDER BY r.created_at DESC LIMIT 5`);
    return {
      total, page, pageSize,
      items: rows.map((r) => ({ ...r, reports: repQ.all(r.id), score: r.type === 'message' ? r.risk_score : engine.analyze({ type: r.type, value: r.value }, registry).score })),
    };
  }

  function exportCsv(status = 'verified') {
    const rows = db.prepare('SELECT type, value, category, status, report_count, first_seen, last_seen FROM indicators WHERE status = ? AND type != ? ORDER BY report_count DESC').all(status, 'message');
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = 'type,value,category,status,report_count,first_seen,last_seen';
    return [head, ...rows.map((r) => [r.type, r.value, r.category, r.status, r.report_count, r.first_seen, r.last_seen].map(esc).join(','))].join('\n');
  }

  return {
    registry, setFeedLookup, scan, createReport, setStatus, retrain, publicRegistry, publicStats, adminStats, adminIndicators, exportCsv,
    reporterHash, ValidationError,
  };
}

module.exports = { makeServices, CATEGORIES, CHANNELS, EMIRATES, TYPES, ValidationError, mask };
