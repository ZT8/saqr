'use strict';
// Campaign radar: groups individual reports into fraud campaigns so authorities see
// "one gang, 40 messages, 6 domains, 3 numbers" instead of 40 unrelated reports.
//
// Indicators are linked when (1) they appear in the same report, (2) URLs share a
// registrable domain, or (3) message texts are near-duplicates (Jaccard similarity of
// normalised word sets, ignoring numbers/links). Connected components = campaigns.

const { tokenize } = require('./engine/normalize');
const { registrableDomain } = require('./engine/url');

class DSU {
  constructor() { this.p = new Map(); }
  find(x) {
    if (!this.p.has(x)) this.p.set(x, x);
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r);
    while (this.p.get(x) !== r) { const n = this.p.get(x); this.p.set(x, r); x = n; }
    return r;
  }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

// Unigrams only, without the __url__/__num__/__phone__ placeholders, so templates match across different links and amounts.
const wordSet = (text) => new Set(tokenize(text).filter((t) => !t.includes('_')));

function makeCampaigns(db, { similarity = 0.45, days = 30, minReports = 3 } = {}) {
  function compute(now = Date.now()) {
    const since = new Date(now - days * 864e5).toISOString();
    const links = db.prepare(`SELECT ri.report_id, ri.indicator_id, r.created_at, r.category, r.channel, r.emirate, r.amount_lost
                              FROM report_indicators ri JOIN reports r ON r.id = ri.report_id WHERE r.created_at >= ?`).all(since);
    if (!links.length) return [];
    const indIds = [...new Set(links.map((l) => l.indicator_id))];
    const inds = new Map(db.prepare(`SELECT id, type, value, status, report_count FROM indicators WHERE id IN (${indIds.map(() => '?').join(',')})`)
      .all(...indIds).map((i) => [i.id, i]));
    const dsu = new DSU();
    indIds.forEach((id) => dsu.find(id));

    // (1) same report
    const byReport = new Map();
    for (const l of links) (byReport.get(l.report_id) || byReport.set(l.report_id, []).get(l.report_id)).push(l.indicator_id);
    for (const ids of byReport.values()) for (let i = 1; i < ids.length; i++) dsu.union(ids[0], ids[i]);

    // (2) same registrable domain
    const byDomain = new Map();
    for (const i of inds.values()) {
      if (i.type !== 'url') continue;
      const d = registrableDomain(i.value.split('/')[0]);
      if (byDomain.has(d)) dsu.union(byDomain.get(d), i.id); else byDomain.set(d, i.id);
    }

    // (3) near-duplicate message templates
    const latest = db.prepare('SELECT content FROM reports WHERE indicator_id = ? AND content IS NOT NULL ORDER BY created_at DESC LIMIT 1');
    const msgs = [...inds.values()].filter((i) => i.type === 'message').map((i) => ({ id: i.id, text: latest.get(i.id)?.content || '' }))
      .map((m) => ({ ...m, set: wordSet(m.text) })).filter((m) => m.set.size >= 3);
    for (let a = 0; a < msgs.length; a++) {
      for (let b = a + 1; b < msgs.length; b++) {
        if (jaccard(msgs[a].set, msgs[b].set) >= similarity) dsu.union(msgs[a].id, msgs[b].id);
      }
    }

    // Build components
    const comps = new Map();
    for (const l of links) {
      const root = dsu.find(l.indicator_id);
      if (!comps.has(root)) comps.set(root, { indicators: new Set(), reports: new Map() });
      const c = comps.get(root);
      c.indicators.add(l.indicator_id);
      c.reports.set(l.report_id, l);
    }

    const h48 = now - 48 * 3600e3, h96 = now - 96 * 3600e3;
    const out = [];
    for (const c of comps.values()) {
      const reports = [...c.reports.values()];
      if (reports.length < minReports) continue;
      const indicators = [...c.indicators].map((id) => inds.get(id));
      const count = (arr, k) => Object.entries(arr.reduce((m, r) => ((m[r[k] || 'unknown'] = (m[r[k] || 'unknown'] || 0) + 1), m), {}))
        .sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, n }));
      const times = reports.map((r) => Date.parse(r.created_at));
      const last48 = times.filter((t) => t >= h48).length;
      const prev48 = times.filter((t) => t >= h96 && t < h48).length;
      const growth = prev48 ? Math.round(((last48 - prev48) / prev48) * 100) : (last48 ? 100 : 0);
      const spiking = last48 >= 5 && last48 >= prev48 * 2;
      const domains = [...new Set(indicators.filter((i) => i.type === 'url').map((i) => registrableDomain(i.value.split('/')[0])))];
      const sample = msgs.find((m) => c.indicators.has(m.id))?.text || null;
      const daily = Array.from({ length: 14 }, (_, k) => {
        const start = now - (14 - k) * 864e5;
        return times.filter((t) => t >= start && t < start + 864e5).length;
      });
      const ids = [...c.indicators].sort((a, b) => a - b);
      out.push({
        id: 'C' + ids[0],
        reports: reports.length,
        last48, prev48, growth, spiking,
        firstSeen: new Date(Math.min(...times)).toISOString(),
        lastSeen: new Date(Math.max(...times)).toISOString(),
        categories: count(reports, 'category').slice(0, 3),
        channels: count(reports, 'channel').slice(0, 3),
        emirates: count(reports, 'emirate').slice(0, 4),
        amountLost: reports.reduce((s, r) => s + (r.amount_lost || 0), 0),
        domains,
        sample,
        daily,
        indicators: indicators.map((i) => ({ id: i.id, type: i.type, value: i.type === 'message' ? null : i.value, status: i.status, reports: i.report_count }))
          .sort((a, b) => b.reports - a.reports),
        unverified: indicators.filter((i) => i.status === 'pending').length,
      });
    }
    return out.sort((a, b) => (b.spiking - a.spiking) || (b.last48 - a.last48) || (b.reports - a.reports));
  }

  return { compute };
}

module.exports = { makeCampaigns, jaccard };
