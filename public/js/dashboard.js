'use strict';
/* global t, applyI18n, toggleLang, fmtNum, fmtDate, api, esc, LANG */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let STATS = null;
const Q = { status: 'pending', type: '', q: '', page: 1 };
let QDATA = null;
const open = new Set();

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/* ---------- Auth ---------- */
async function checkSession() {
  try {
    const me = await api('/api/admin/me');
    showDash(me.user);
  } catch {
    $('#loginView').hidden = false;
    $('#dashView').hidden = true;
  }
}

function showDash(user) {
  $('#loginView').hidden = true;
  $('#dashView').hidden = false;
  $('#whoami').textContent = user;
  route();
  loadAll();
}

/* ---------- Screens (sidebar items are screens, not anchors) ---------- */
const SCREENS = { overview: 'nav_overview', radar: 'radar_title', queue: 'queue', cases: 'cases_title', sources: 'nav_sources', system: 'nav_system' };
function route() {
  const v = (location.hash || '#overview').slice(1);
  const view = SCREENS[v] ? v : 'overview';
  $$('[data-screen]').forEach((s) => { s.hidden = s.dataset.screen !== view; });
  $$('.side-nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.view === view ? 'page' : 'false'));
  $('#viewTitle').textContent = t('dash_title');
  if (view === 'overview' && typeof STATS !== 'undefined' && STATS) renderStats();
}

function renderCounts() {
  if (STATS) $('#nQueue').textContent = STATS.totals.pending ? fmtNum(STATS.totals.pending) : '';
  if (CAMPS) { const n = CAMPS.filter((c) => c.spiking).length; $('#nRadar').textContent = n ? fmtNum(n) : ''; }
  if (CASES) { const n = CASES.counts.new || 0; $('#nCases').textContent = n ? fmtNum(n) : ''; }
  // The screen's one finding, read first.
  if (STATS && CAMPS) {
    const spike = CAMPS.find((c) => c.spiking);
    $('#finding').textContent = spike
      ? t('finding_spike', { cat: t('cat_' + spike.categories[0].key), a: fmtNum(spike.last48), b: fmtNum(spike.prev48), n: fmtNum(spike.unverified) })
      : t('finding_calm', { n: fmtNum(STATS.totals.pending) });
  }
}

async function login(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target).entries());
  $('#loginError').textContent = '';
  try {
    const out = await api('/api/admin/login', { method: 'POST', body: f });
    showDash(out.user);
  } catch (ex) {
    $('#loginError').textContent = t('e_' + ex.code);
  }
}

async function logout() {
  await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
  location.reload();
}

/* ---------- Charts (hand-drawn SVG, no external libs) ---------- */
function barChart(daily, key, W = 640) {
  const H = 200, P = { t: 10, r: 30, b: 24, l: 30 };
  const max = Math.max(1, ...daily.map((d) => d[key]));
  const step = Math.max(1, Math.ceil(max / 4));
  const nice = step * 4;
  const bw = (W - P.l - P.r) / daily.length;
  const y = (v) => H - P.b - (v / nice) * (H - P.t - P.b);
  const rtl = LANG === 'ar';
  const x = (i) => (rtl ? W - P.r - (i + 1) * bw : P.l + i * bw);
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = step * k, yy = y(v);
    g += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${yy}" y2="${yy}"/><text class="axis" x="${rtl ? W - 2 : 2}" y="${yy + 3}" text-anchor="${rtl ? 'end' : 'start'}">${fmtNum(Math.round(v))}</text>`;
  }
  const bars = daily.map((d, i) => {
    const h = H - P.b - y(d[key]);
    return `<rect class="bar${i >= daily.length - 7 ? ' recent' : ''}" x="${(x(i) + bw * 0.18).toFixed(1)}" y="${y(d[key]).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2"><title>${d.day}: ${d[key]}</title></rect>`;
  }).join('');
  const every = W < 480 ? 10 : 5;
  const labels = daily.map((d, i) => (i % every === 0 || i === daily.length - 1)
    ? `<text class="axis" x="${(x(i) + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'numeric' }).format(new Date(d.day))}</text>` : '').join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}${bars}${labels}</svg>`;
}

function lineChart(daily, key, W = 320) {
  const H = 200, P = { t: 10, r: 6, b: 24, l: 6 };
  const max = Math.max(1, ...daily.map((d) => d[key]));
  const rtl = LANG === 'ar';
  const step = (W - P.l - P.r) / (daily.length - 1 || 1);
  const pts = daily.map((d, i) => [rtl ? W - P.r - i * step : P.l + i * step, H - P.b - (d[key] / max) * (H - P.t - P.b)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H - P.b} L${pts[0][0].toFixed(1)} ${H - P.b} Z`;
  const total = daily.reduce((s, d) => s + d[key], 0);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"><path class="area" d="${area}"/><path class="line" d="${line}"/>
    <text class="axis" x="${W / 2}" y="${H - 6}" text-anchor="middle">${fmtNum(total)} · 30d</text></svg>`;
}

function hbars(el, rows, prefix) {
  const max = Math.max(1, ...rows.map((r) => r.c));
  el.innerHTML = rows.map((r) => `<div class="hbar"><span>${esc(t(prefix + r.k))}</span><span class="track"><span class="fill" data-w="${((r.c / max) * 100).toFixed(1)}"></span></span><b>${fmtNum(r.c)}</b></div>`).join('') || `<p class="muted">${esc(t('no_items'))}</p>`;
  // CSP forbids inline style attributes; set widths through the CSSOM instead.
  el.querySelectorAll('[data-w]').forEach((f) => { f.style.width = f.dataset.w + '%'; });
}

/* ---------- Stats ---------- */
function renderStats() {
  if (!STATS) return;
  const s = STATS.totals;
  const delta = s.prev7 ? Math.round(((s.last7 - s.prev7) / s.prev7) * 100) : 0;
  const kpi = (label, val, sub = '', cls = '') => `<div class="kpi ${cls}"><div class="k-label">${esc(t(label))}</div><div class="k-val">${val}</div><div class="k-sub">${sub}</div></div>`;
  $('#kpis').innerHTML = [
    kpi('k_reports', fmtNum(s.reports)),
    kpi('k_pending', fmtNum(s.pending), '', s.pending ? 'alert' : ''),
    kpi('k_verified', fmtNum(s.verified)),
    kpi('k_week', fmtNum(s.last7), s.prev7 ? `<span class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${fmtNum(Math.abs(delta))}%</span> ${esc(t('vs_prev'))}` : '—'),
    kpi('k_scans', fmtNum(s.scans), `${esc(t('k_dangerous'))}: ${fmtNum(s.dangerousScans)}`),
    kpi('k_cases', fmtNum(STATS.openCases || 0), '', STATS.openCases ? 'alert' : ''),
    kpi('k_lost', `${fmtNum(Math.round(s.amountLost))}<small>${esc(t('k_lost_unit'))}</small>`),
  ].join('');
  // Draw at the container's real width so axis labels stay 11px on a phone.
  const tw = Math.max(280, $('#trendChart').clientWidth || 640), sw = Math.max(240, $('#scanChart').clientWidth || 320);
  $('#trendChart').innerHTML = barChart(STATS.daily, 'reports', tw);
  $('#scanChart').innerHTML = lineChart(STATS.daily, 'scans', sw);
  hbars($('#byCategory'), STATS.byCategory, 'cat_');
  hbars($('#byEmirate'), STATS.byEmirate, 'em_');
  hbars($('#byChannel'), STATS.byChannel, 'ch_');
  const m = STATS.model;
  $('#modelInfo').innerHTML = `
    <dt>${esc(t('model_samples'))}</dt><dd>${fmtNum(m.samples)}</dd>
    <dt>${esc(t('model_vocab'))}</dt><dd>${fmtNum(m.vocabulary)}</dd>
    <dt>${esc(t('model_learned'))}</dt><dd>${fmtNum(m.learned)}</dd>
    <dt>${esc(t('model_trained'))}</dt><dd>${esc(fmtDate(m.trainedAt))}</dd>`;
}

/* ---------- Queue ---------- */
function levelOf(score) { return score >= 65 ? 'dangerous' : score >= 30 ? 'suspicious' : 'safe'; }

function renderQueue() {
  if (!QDATA) return;
  const body = $('#queueBody');
  if (!QDATA.items.length) {
    body.innerHTML = `<tr><td colspan="6" class="muted">${esc(t('no_items'))}</td></tr>`;
    $('#qPager').innerHTML = '';
    return;
  }
  body.innerHTML = QDATA.items.map((it) => {
    const sample = it.type === 'message' ? (it.reports.find((r) => r.content)?.content || '') : '';
    const ind = it.type === 'message'
      ? `<span class="badge">${esc(t('t_message'))}</span> <span class="msg" dir="auto">${esc(sample)}</span>`
      : `<span class="badge">${esc(t('t_' + it.type))}</span> <span class="val" dir="ltr">${esc(it.value)}</span>`;
    const score = it.score ?? 0;
    const btns = [];
    if (it.status !== 'verified') btns.push(`<button class="btn-danger btn-sm" data-act="verified" data-id="${it.id}">${esc(t('a_verify'))}</button>`);
    if (it.status !== 'rejected') btns.push(`<button class="btn-ghost btn-sm" data-act="rejected" data-id="${it.id}">${esc(t('a_reject'))}</button>`);
    if (it.status !== 'pending') btns.push(`<button class="btn-ghost btn-sm" data-act="pending" data-id="${it.id}">${esc(t('a_reset'))}</button>`);
    btns.push(`<button class="btn-ghost btn-sm" data-toggle="${it.id}" aria-expanded="${open.has(it.id)}">${esc(t('a_details'))}</button>`);
    const details = open.has(it.id) ? `<tr class="details-row"><td colspan="6"><strong>${esc(t('recent_reports'))}</strong>${it.reports.map((r) => `
      <div class="rep">
        ${r.content ? `<div dir="auto">${esc(r.content)}</div>` : ''}
        <div class="rep-meta"><span>${esc(t('cat_' + r.category))}</span><span>${esc(t('ch_' + r.channel))}</span><span>${esc(t('em_' + (r.emirate || 'unknown')))}</span>${r.amount_lost ? `<span>${esc(t('amount', { n: fmtNum(r.amount_lost) }))}</span>` : ''}<span>${esc(fmtDate(r.created_at))}</span></div>
      </div>`).join('')}</td></tr>` : '';
    return `<tr>
      <td class="ind">${ind}</td>
      <td>${esc(t('cat_' + it.category))}</td>
      <td class="num">${fmtNum(it.report_count)}</td>
      <td><span class="pill lvl-${levelOf(score)}">${fmtNum(score)}</span></td>
      <td>${esc(fmtDate(it.last_seen))}</td>
      <td><div class="actions">${btns.join('')}</div></td>
    </tr>${details}`;
  }).join('');
  const pages = Math.max(1, Math.ceil(QDATA.total / QDATA.pageSize));
  $('#qPager').innerHTML = pages > 1 ? `
    <button class="btn-ghost btn-sm" ${Q.page <= 1 ? 'disabled' : ''} data-p="${Q.page - 1}">${esc(t('prev'))}</button>
    <span>${esc(t('page_of', { p: fmtNum(Q.page), t: fmtNum(pages) }))}</span>
    <button class="btn-ghost btn-sm" ${Q.page >= pages ? 'disabled' : ''} data-p="${Q.page + 1}">${esc(t('next'))}</button>` : '';
}

async function loadQueue() {
  const qs = new URLSearchParams({ status: Q.status, type: Q.type, q: Q.q, page: Q.page });
  QDATA = await api('/api/admin/indicators?' + qs);
  renderQueue();
}

async function loadStats() {
  STATS = await api('/api/admin/stats');
  renderStats();
}

async function loadAudit() {
  const rows = await api('/api/admin/audit');
  $('#audit').innerHTML = rows.map((r) => `<li><span><b>${esc(r.admin)}</b> · <span class="val" dir="ltr">${esc(r.action)}</span> ${r.target ? `<span class="val" dir="ltr">${esc(r.target.slice(0, 40))}</span>` : ''}</span><span class="muted">${esc(fmtDate(r.created_at))}</span></li>`).join('');
}

/* ---------- Campaign radar ---------- */
let CAMPS = null;
const openCamps = new Set();

function spark(arr) {
  const W = 140, H = 34, max = Math.max(1, ...arr);
  const rtl = LANG === 'ar';
  const bw = W / arr.length;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">${arr.map((v, i) => {
    const h = Math.max(1.5, (v / max) * (H - 2));
    const x = rtl ? W - (i + 1) * bw : i * bw;
    return `<rect x="${(x + 1).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="1" class="${i >= arr.length - 2 ? 'hot' : ''}"/>`;
  }).join('')}</svg>`;
}

function renderCampaigns() {
  const el = $('#campaigns');
  if (!CAMPS) return;
  const list = CAMPS.slice(0, 6);
  if (!list.length) { el.innerHTML = `<p class="muted">${esc(t('camp_none'))}</p>`; return; }
  el.innerHTML = list.map((c) => {
    const cat = c.categories[0]?.key;
    const head = c.domains[0] || c.indicators.find((i) => i.value)?.value || '';
    const pending = c.indicators.filter((i) => i.status === 'pending');
    const isOpen = openCamps.has(c.id);
    return `<article class="camp ${c.spiking ? 'spiking' : ''}">
      <div class="camp-top">
        <div>
          ${c.spiking ? `<span class="spike-badge">${esc(t('spiking'))}</span>` : ''}
          <h3>${esc(t('cat_' + cat))}${head ? ` · <span class="val" dir="ltr">${esc(head)}</span>` : ''}</h3>
          <p class="muted">${esc(t('camp_reports', { n: fmtNum(c.reports) }))} · ${esc(t('camp_48', { a: fmtNum(c.last48), b: fmtNum(c.prev48) }))}${c.amountLost ? ' · ' + esc(t('amount', { n: fmtNum(Math.round(c.amountLost)) })) : ''}</p>
        </div>
        <div class="camp-spark" title="${esc(t('camp_14d'))}">${spark(c.daily)}</div>
      </div>
      <div class="camp-meta">
        ${c.domains.length ? `<span>${esc(t('camp_domains'))}: ${c.domains.map((d) => `<span class="val" dir="ltr">${esc(d)}</span>`).join(' ')}</span>` : ''}
        <span>${c.emirates.map((e) => esc(t('em_' + e.key)) + ' ' + fmtNum(e.n)).join(' · ')}</span>
        <span>${c.channels.map((e) => esc(t('ch_' + e.key))).join(' · ')}</span>
      </div>
      ${isOpen ? `<div class="camp-detail">
        ${c.sample ? `<p class="reg-sample" dir="auto"><strong>${esc(t('camp_sample'))}:</strong> ${esc(c.sample)}</p>` : ''}
        <ul class="camp-inds">${c.indicators.map((i) => `<li><span class="badge">${esc(t('t_' + i.type))}</span> ${i.value ? `<span class="val" dir="ltr">${esc(i.value)}</span>` : '<span class="muted">—</span>'} <span class="st st-${esc(i.status)}">${esc(t('tab_' + i.status))}</span> <span class="muted">${esc(t('reports_n', { n: fmtNum(i.reports) }))}</span></li>`).join('')}</ul>
      </div>` : ''}
      <div class="row-actions">
        ${pending.length ? `<button class="btn-danger btn-sm" data-camp-verify="${esc(c.id)}">${esc(t('camp_verify_all', { n: fmtNum(pending.length) }))}</button>` : `<span class="muted">${esc(t('camp_all_verified'))}</span>`}
        <button class="btn-ghost btn-sm" data-camp-toggle="${esc(c.id)}" aria-expanded="${isOpen}">${esc(t('camp_indicators'))} (${fmtNum(c.indicators.length)})</button>
      </div>
    </article>`;
  }).join('');
}

async function loadCampaigns() {
  CAMPS = await api('/api/admin/campaigns');
  renderCampaigns();
}

/* ---------- Extortion cases ---------- */
let CASES = null, CASE_FILTER = '', CASE = null;

function renderCases() {
  if (!CASES) return;
  $('#caseList').innerHTML = CASES.items.length ? CASES.items.map((c) => `
    <li><button type="button" class="case-row ${CASE && CASE.id === c.id ? 'active' : ''}" data-case="${c.id}">
      <span class="val" dir="ltr">${esc(c.ref)}</span>
      <span class="case-st cs-${esc(c.status)}">${esc(t('cs_' + c.status))}</span>
      <span class="muted">${esc(t('pl_' + c.platform))} · ${esc(t('dm_' + c.demand))} · ${esc(t('case_files'))}: ${fmtNum(c.evidence)}</span>
      <span class="muted">${esc(fmtDate(c.created_at))}</span>
    </button></li>`).join('') : `<li class="muted">${esc(t('no_items'))}</li>`;
  renderCase();
}

function renderCase() {
  const el = $('#caseDetail');
  if (!CASE) { el.innerHTML = `<p class="muted">${esc(t(CASES && CASES.items.length ? 'case_pick' : 'no_items'))}</p>`; return; }
  const c = CASE;
  el.innerHTML = `
    <div class="case-head"><span class="val" dir="ltr">${esc(c.ref)}</span> <span class="case-st cs-${esc(c.status)}">${esc(t('cs_' + c.status))}</span></div>
    <dl class="track-dl">
      <dt>${esc(t('f_platform'))}</dt><dd>${esc(t('pl_' + c.platform))}</dd>
      <dt>${esc(t('f_demand'))}</dt><dd>${esc(t('dm_' + c.demand))}</dd>
      <dt>${esc(t('case_paid'))}</dt><dd>${esc(c.paid ? t('yes') : t('no'))}</dd>
      <dt>${esc(t('f_emirate'))}</dt><dd>${esc(t('em_' + (c.emirate || 'unknown')))}</dd>
      <dt>${esc(t('case_extorter'))}</dt><dd dir="auto">${esc(c.details.extorter || t('none_given'))}</dd>
      <dt>${esc(t('case_contact'))}</dt><dd dir="auto">${esc(c.details.contact || t('none_given'))}</dd>
    </dl>
    <h3>${esc(t('case_desc'))}</h3><p class="reg-sample" dir="auto">${esc(c.details.description)}</p>
    <h3>${esc(t('case_files'))}</h3>
    <ul class="evidence">${c.evidence.map((e) => `<li><span dir="auto">${esc(e.name)}</span> <span class="muted">${esc(e.mime)} · ${(e.size / 1024).toFixed(0)} KB</span>
      <span class="val" dir="ltr" title="SHA-256">${esc(e.sha256.slice(0, 20))}…</span>
      <a class="btn-ghost btn-sm" target="_blank" rel="noopener" href="/api/admin/cases/${c.id}/evidence/${e.id}">${esc(t('case_view'))}</a></li>`).join('') || `<li class="muted">${esc(t('no_items'))}</li>`}</ul>
    <form id="caseUpdate" class="case-form">
      <select name="status">${['new', 'in_progress', 'closed'].map((s) => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${esc(t('cs_' + s))}</option>`).join('')}</select>
      <textarea name="note" rows="2" dir="auto" placeholder="${esc(t('case_note_ph'))}">${esc(c.public_note || '')}</textarea>
      <button class="btn-primary btn-sm" type="submit">${esc(t('case_save'))}</button>
    </form>
    <h3>${esc(t('case_custody'))}</h3>
    <ul class="audit">${c.custody.map((l) => `<li><span><b>${esc(l.actor)}</b> · <span class="val" dir="ltr">${esc(l.action)}</span> ${l.detail ? `<span class="val" dir="ltr">${esc(l.detail.slice(0, 48))}</span>` : ''}</span><span class="muted">${esc(fmtDate(l.created_at))}</span></li>`).join('')}</ul>`;
  $('#caseUpdate').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api(`/api/admin/cases/${c.id}`, { method: 'POST', body: f });
      toast(t('case_saved'));
      await openCase(c.id);
      await loadCases();
      loadStats();
    } catch (ex) { toast(t('e_' + ex.code)); }
  });
}

async function loadCases() {
  CASES = await api('/api/admin/cases?status=' + CASE_FILTER);
  renderCases();
}

async function openCase(id) {
  CASE = await api('/api/admin/cases/' + id);
  renderCases();
}

/* ---------- Data sources ---------- */
let SOURCES = null;
function feedStatus(f) {
  if (!f.enabled) return `<span class="st-off">${esc(t('st_off'))}</span>`;
  if (!f.last_run) return `<span class="muted">${esc(t('st_never'))}</span>`;
  if (String(f.last_status).startsWith('error')) return `<span class="st-err" title="${esc(f.last_status)}">${esc(t('st_error'))}</span>`;
  return `<span class="st-ok">${esc(t('st_ok'))}</span>`;
}
function renderSources() {
  if (!SOURCES) return;
  $('#feedBody').innerHTML = SOURCES.feeds.map((f) => `<tr>
    <td class="ind"><b dir="auto">${esc(f.name)}</b><div class="muted small">${esc(f.builtin ? f.license : t('src_uploaded'))} · ${esc(t('t_' + f.type))}</div></td>
    <td class="num">${fmtNum(f.count)}</td>
    <td>${f.last_run ? esc(fmtDate(f.last_run)) : '—'}</td>
    <td>${feedStatus(f)}</td>
    <td><div class="actions">
      ${f.url ? `<button class="btn-primary btn-sm" data-feed-update="${esc(f.id)}">${esc(t('a_update'))}</button>` : ''}
      <button class="btn-ghost btn-sm" data-feed-enable="${esc(f.id)}" data-on="${f.enabled ? 0 : 1}">${esc(t(f.enabled ? 'a_disable' : 'a_enable'))}</button>
      ${f.builtin ? '' : `<button class="btn-ghost btn-sm" data-feed-remove="${esc(f.id)}">${esc(t('a_remove'))}</button>`}
    </div></td></tr>`).join('');
  const sel = $('#termTactic'), cur = sel.value;
  sel.innerHTML = SOURCES.tactics.map((k) => `<option value="${esc(k)}">${esc(t('tac_' + k))}</option>`).join('');
  if (cur) sel.value = cur;
  $('#termList').innerHTML = SOURCES.terms.length ? SOURCES.terms.map((x) => `<li><span class="badge">${esc(t('tac_' + x.tactic))}</span><span dir="auto">${esc(x.term)}</span><button class="btn-ghost btn-sm" data-term-remove="${x.id}" aria-label="${esc(t('a_remove'))}">${esc(t('a_remove'))}</button></li>`).join('') : `<li class="muted">${esc(t('no_terms'))}</li>`;
}
async function loadSources() { SOURCES = await api('/api/admin/sources'); renderSources(); }

async function loadAll() {
  try {
    await Promise.all([loadStats(), loadQueue(), loadAudit(), loadCampaigns(), loadCases(), loadSources()]);
    renderCounts();
  } catch (ex) {
    if (ex.status === 401) location.reload();
  }
}

async function act(id, status) {
  try {
    const out = await api(`/api/admin/indicators/${id}/status`, { method: 'POST', body: { status } });
    toast(out.learned ? t('learned_toast') : t('updated_toast'));
    await loadAll();
  } catch (ex) {
    toast(t('e_' + ex.code));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  $('#langBtn').addEventListener('click', toggleLang);
  document.addEventListener('langchange', () => { route(); renderStats(); renderQueue(); renderCampaigns(); renderCases(); renderCounts(); loadAudit().catch(() => {}); });
  window.addEventListener('hashchange', route);
  document.addEventListener('langchange', renderSources);
  $('#feedBody').addEventListener('click', async (e) => {
    const u = e.target.closest('[data-feed-update]'), en = e.target.closest('[data-feed-enable]'), rm = e.target.closest('[data-feed-remove]');
    try {
      if (u) { u.disabled = true; u.textContent = t('updating'); const r = await api(`/api/admin/sources/${u.dataset.feedUpdate}/update`, { method: 'POST' }); toast(t('updated_n', { n: fmtNum(r.count) })); }
      else if (en) await api(`/api/admin/sources/${en.dataset.feedEnable}/enabled`, { method: 'POST', body: { enabled: en.dataset.on === '1' } });
      else if (rm) await api(`/api/admin/sources/${rm.dataset.feedRemove}`, { method: 'DELETE' });
      else return;
    } catch (ex) { toast(t(ex.code === 'feed_failed' ? 'feed_failed_toast' : 'e_' + ex.code)); }
    loadSources(); loadAudit();
  });
  $('#updateAll').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = t('updating');
    try { await api('/api/admin/sources/update-all', { method: 'POST' }); } catch { /* per-feed status shows failures */ }
    b.disabled = false; b.textContent = t('a_update_all');
    loadSources(); loadAudit();
  });
  $('#listFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (f) { $('#uploadForm textarea[name=text]').value = await f.text(); if (!$('#uploadForm input[name=name]').value) $('#uploadForm input[name=name]').value = f.name.replace(/\.[^.]+$/, ''); }
  });
  $('#uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#uploadError').textContent = '';
    const body = Object.fromEntries(new FormData(e.target).entries());
    try { const r = await api('/api/admin/sources/upload', { method: 'POST', body }); toast(t('uploaded_toast', { n: fmtNum(r.count) })); e.target.reset(); loadSources(); loadAudit(); }
    catch (ex) { $('#uploadError').textContent = t('e_' + ex.code); }
  });
  $('#termForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#termError').textContent = '';
    const body = Object.fromEntries(new FormData(e.target).entries());
    try { await api('/api/admin/terms', { method: 'POST', body }); toast(t('term_added')); e.target.term.value = ''; loadSources(); loadAudit(); }
    catch (ex) { $('#termError').textContent = t('e_' + ex.code); }
  });
  $('#termList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-term-remove]');
    if (!b) return;
    await api('/api/admin/terms/' + b.dataset.termRemove, { method: 'DELETE' }).catch(() => {});
    loadSources(); loadAudit();
  });
  $('#termImport').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const r = await api('/api/admin/terms/import', { method: 'POST', body: { text: e.target.text.value, tactic: $('#termTactic').value } }); toast(t('imported_toast', { a: fmtNum(r.added), s: fmtNum(r.skipped) })); e.target.reset(); loadSources(); loadAudit(); }
    catch (ex) { toast(t('e_' + ex.code)); }
  });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (STATS) renderStats(); }, 150); });
  $('#campaigns').addEventListener('click', async (e) => {
    const tg = e.target.closest('[data-camp-toggle]');
    if (tg) { const id = tg.dataset.campToggle; openCamps.has(id) ? openCamps.delete(id) : openCamps.add(id); return renderCampaigns(); }
    const v = e.target.closest('[data-camp-verify]');
    if (v) {
      const c = CAMPS.find((x) => x.id === v.dataset.campVerify);
      v.disabled = true;
      try {
        const out = await api('/api/admin/campaigns/verify', { method: 'POST', body: { indicatorIds: c.indicators.filter((i) => i.status === 'pending').map((i) => i.id) } });
        toast(t('camp_verified_toast', { n: fmtNum(out.verified) }));
        await loadAll();
      } catch (ex) { toast(t('e_' + ex.code)); v.disabled = false; }
    }
  });
  $('#caseStatusTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cs]');
    if (!b) return;
    CASE_FILTER = b.dataset.cs;
    $$('#caseStatusTabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    loadCases();
  });
  $('#caseList').addEventListener('click', (e) => { const b = e.target.closest('[data-case]'); if (b) openCase(Number(b.dataset.case)); });
  $('#loginForm').addEventListener('submit', login);
  $('#logoutBtn').addEventListener('click', logout);
  $('#statusTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    Q.status = b.dataset.status; Q.page = 1;
    $$('#statusTabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    loadQueue();
  });
  $('#qType').addEventListener('change', (e) => { Q.type = e.target.value; Q.page = 1; loadQueue(); });
  let deb;
  $('#qSearch').addEventListener('input', (e) => { clearTimeout(deb); deb = setTimeout(() => { Q.q = e.target.value.trim(); Q.page = 1; loadQueue(); }, 250); });
  $('#queueBody').addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a) return act(a.dataset.id, a.dataset.act);
    const tg = e.target.closest('[data-toggle]');
    if (tg) { const id = Number(tg.dataset.toggle); open.has(id) ? open.delete(id) : open.add(id); renderQueue(); }
  });
  $('#qPager').addEventListener('click', (e) => { const p = e.target.closest('[data-p]'); if (p) { Q.page = Number(p.dataset.p); loadQueue(); } });
  checkSession();
});
