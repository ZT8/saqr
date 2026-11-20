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
  $('#whoami').hidden = false;
  $('#whoami').textContent = user;
  $('#logoutBtn').hidden = false;
  loadAll();
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
function barChart(daily, key) {
  const W = 640, H = 200, P = { t: 10, r: 30, b: 24, l: 30 };
  const max = Math.max(1, ...daily.map((d) => d[key]));
  const nice = Math.ceil(max / 5) * 5 || 5;
  const bw = (W - P.l - P.r) / daily.length;
  const y = (v) => H - P.b - (v / nice) * (H - P.t - P.b);
  const rtl = LANG === 'ar';
  const x = (i) => (rtl ? W - P.r - (i + 1) * bw : P.l + i * bw);
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = (nice / 4) * k, yy = y(v);
    g += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${yy}" y2="${yy}"/><text class="axis" x="${rtl ? W - 2 : 2}" y="${yy + 3}" text-anchor="${rtl ? 'end' : 'start'}">${fmtNum(Math.round(v))}</text>`;
  }
  const bars = daily.map((d, i) => {
    const h = H - P.b - y(d[key]);
    return `<rect class="bar${i >= daily.length - 7 ? ' recent' : ''}" x="${(x(i) + bw * 0.18).toFixed(1)}" y="${y(d[key]).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2"><title>${d.day}: ${d[key]}</title></rect>`;
  }).join('');
  const labels = daily.map((d, i) => (i % 5 === 0 || i === daily.length - 1)
    ? `<text class="axis" x="${(x(i) + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${new Intl.DateTimeFormat(LANG === 'ar' ? 'ar-AE' : 'en-AE', { day: 'numeric', month: 'numeric' }).format(new Date(d.day))}</text>` : '').join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}${bars}${labels}</svg>`;
}

function lineChart(daily, key) {
  const W = 320, H = 200, P = { t: 10, r: 6, b: 24, l: 6 };
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
    kpi('k_week', fmtNum(s.last7), `<span class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'} ${fmtNum(Math.abs(delta))}%</span> ${esc(t('vs_prev'))}`),
    kpi('k_scans', fmtNum(s.scans), `${esc(t('k_dangerous'))}: ${fmtNum(s.dangerousScans)}`),
    kpi('k_lost', esc(t('amount', { n: fmtNum(Math.round(s.amountLost)) }))),
  ].join('');
  $('#trendChart').innerHTML = barChart(STATS.daily, 'reports');
  $('#scanChart').innerHTML = lineChart(STATS.daily, 'scans');
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
      : `<span class="badge">${esc(t('t_' + it.type))}</span> <code dir="ltr">${esc(it.value)}</code>`;
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
  $('#audit').innerHTML = rows.map((r) => `<li><span><b>${esc(r.admin)}</b> · <code dir="ltr">${esc(r.action)}</code> ${r.target ? `<code dir="ltr">${esc(r.target.slice(0, 40))}</code>` : ''}</span><span class="muted">${esc(fmtDate(r.created_at))}</span></li>`).join('');
}

async function loadAll() {
  try {
    await Promise.all([loadStats(), loadQueue(), loadAudit()]);
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
  document.addEventListener('langchange', () => { renderStats(); renderQueue(); loadAudit().catch(() => {}); });
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
