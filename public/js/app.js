'use strict';
/* global t, reasonText, applyI18n, toggleLang, fmtNum, fmtDate, api, esc, LANG */

document.documentElement.classList.add('js');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const EXAMPLES = {
  fine: 'شرطة أبوظبي: لديك مخالفة مرورية غير مدفوعة بقيمة 400 درهم، ادفع خلال 24 ساعة لتجنب حجز المركبة adpolice-fines.com/pay',
  bank: 'هلا اخوي معك موظف البنك، بطاقتك موقوفة. عطني رمز التحقق اللي وصلك عشان نفعلها، أو تواصل واتساب +971 50 913 2207',
  link: 'http://emiratesnbd-secure-login.xyz/verify?account=update',
  safe: 'هلا اخوي، نتغدى اليوم مع الشباب بعد صلاة الظهر؟',
};

let META = { categories: [], channels: [], emirates: [] };
let scanType = 'auto';
let lastScan = null; // { type, value, result }
let regPage = 1;

/* ---------- Routing ---------- */
function route() {
  let tab = (location.hash || '#scan').slice(1);
  if (tab === 'tips') tab = 'train';
  const valid = ['scan', 'report', 'registry', 'train', 'help'].includes(tab) ? tab : 'scan';
  $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + valid; });
  $$('.nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === valid ? 'page' : 'false'));
  if (valid === 'registry') loadRegistry();
  if (valid === 'scan') loadStats();
  if (valid === 'train' && typeof startTraining === 'function' && !TRAIN.questions.length) startTraining();
  window.scrollTo({ top: 0 });
}

/* ---------- Stats ---------- */
async function loadStats() {
  try {
    const s = await api('/api/stats');
    $('#stVerified').textContent = fmtNum(s.verified);
    $('#stReports').textContent = fmtNum(s.reports);
    $('#stScans').textContent = fmtNum(s.scans);
    STATS = s;
    renderScams();
  } catch { /* stats are decorative */ }
}

let STATS = null;
const SCAM_GROUPS = [['list_g1', ['fake_fine', 'bank_otp', 'impersonation', 'parcel']], ['list_g2', ['prize', 'investment', 'job', 'family_emergency', 'shopping']]];

function renderScams() {
  const el = $('#scamGroups');
  if (!el) return;
  const by = (STATS && STATS.byCategory) || {};
  el.innerHTML = SCAM_GROUPS.map(([title, cats]) => {
    const sorted = cats.slice().sort((a, b) => (by[b] || 0) - (by[a] || 0));
    const total = cats.reduce((n, c) => n + (by[c] || 0), 0);
    return `<div class="scam-group"><h3>${esc(t(title))}<span>${esc(t('list_reports', { n: fmtNum(total) }))}</span></h3><ul>${sorted.map((c) => `
      <li><span class="bait" aria-hidden="true">${esc(t('bait_' + c))}</span>
        <div><div class="scam-row"><b>${esc(t('cat_' + c))}</b><span>${esc(t('list_reports', { n: fmtNum(by[c] || 0) }))}</span></div>
        <p>${esc(t('sc_' + c))}</p></div></li>`).join('')}</ul></div>`;
  }).join('');
}

/* ---------- Motion: section entrances and the eye that watches ---------- */
function setupMotion() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const groups = ['.how > h2', '.tile', '.scams > h2', '.scam-group', '.stats > div', '.why-shape', '.why-text > h2', '.points li', '.faq > h2', '.faq details', '.foot-mark .blk'];
  const els = [];
  for (const sel of groups) $$(sel).forEach((el, i) => { el.classList.add('reveal'); el.style.setProperty('--d', `${Math.min(i, 8) * 70}ms`); els.push(el); });
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
  const eye = $('#heroEye .eye-look');
  if (eye && !reduce && matchMedia('(pointer: fine)').matches) {
    let raf = 0;
    addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const box = $('#heroEye').getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (e.clientX - (box.left + box.width * 0.54)) / (box.width / 2)));
        const dy = Math.max(-1, Math.min(1, (e.clientY - (box.top + box.height * 0.47)) / (box.height / 2)));
        eye.style.transform = `translate(${(dx * 60).toFixed(1)}px, ${(dy * 40).toFixed(1)}px)`;
      });
    }, { passive: true });
  }
}

/* ---------- Scan ---------- */
function setScanType(type) {
  scanType = type;
  $$('#typeSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.type === type)));
}

const SEV_ORDER = { high: 0, medium: 1, low: 2, info: 3, safe: 4 };

function reasonList(reasons) {
  return reasons
    .slice()
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
    .map((r) => `<li class="sev-${esc(r.severity)}"><span class="dot" aria-hidden="true"></span><span>${esc(reasonText(r))}</span></li>`)
    .join('');
}

function gauge(score, level) {
  // The result wears Saqr's eye: the iris carries the verdict colour and the score.
  return `<svg class="r-eye lvl-${level}" viewBox="0 0 100 60" aria-hidden="true">
    <path class="w" d="M0 30C24 -6 76 -6 100 30C76 66 24 66 0 30Z"/>
    <circle class="i" cx="50" cy="30" r="22"/>
    <text x="50" y="39" text-anchor="middle">${fmtNum(score)}</text>
  </svg>`;
}

function renderResult() {
  const box = $('#result');
  const eye = $('#heroEye');
  if (!lastScan) { box.hidden = true; if (eye) eye.setAttribute('class', 'hero-eye'); return; }
  const r = lastScan.result;
  if (eye) eye.setAttribute('class', 'hero-eye lvl-' + r.level);
  const entities = (r.entities || []).map((e) => `
    <div class="entity lvl-${e.level}">
      <div class="entity-head"><span class="badge">${esc(t('t_' + e.type))}</span><span class="val" dir="ltr" title="${esc(e.input)}">${esc(e.input)}</span><span class="pill lvl-${e.level}">${fmtNum(e.score)}</span></div>
      <ul class="reasons small">${reasonList(e.reasons)}</ul>
    </div>`).join('');
  box.className = 'result lvl-' + r.level;
  box.innerHTML = `
    <div class="result-head">
      ${gauge(r.score, r.level)}
      <div>
        <h2>${esc(t('level_' + r.level))}</h2>
        <p>${esc(t('level_' + r.level + '_d'))}</p>
        <p class="r-meta">${esc(t('result_meta', { s: fmtNum(r.score), type: t('t_' + r.detectedType) }))}</p>
      </div>
    </div>
    <div class="result-body">
      <section><h3>${esc(t('why'))}</h3><ul class="reasons">${reasonList(r.reasons)}</ul></section>
      ${entities ? `<section><h3>${esc(t('inside'))}</h3>${entities}</section>` : ''}
      <section><h3>${esc(t('what_to_do'))}</h3><ol class="advice">${r.advice.map((a) => `<li>${esc(t(a))}</li>`).join('')}</ol></section>
    </div>
    <div class="result-actions">
      ${r.level !== 'safe' ? `<button class="btn-danger" type="button" id="toReport">${esc(t('report_this'))}</button>` : ''}
      <button class="btn-ghost" type="button" id="scanAgain">${esc(t('scan_another'))}</button>
    </div>`;
  box.hidden = false;
  $('#toReport')?.addEventListener('click', () => prefillReport(r.detectedType, lastScan.value));
  $('#scanAgain').addEventListener('click', () => {
    lastScan = null; renderResult(); $('#scanInput').value = ''; $('#scanInput').focus();
  });
}

async function doScan(e) {
  e.preventDefault();
  const value = $('#scanInput').value;
  const err = $('#scanError');
  err.textContent = '';
  if (!value.trim()) { err.textContent = t('e_empty_value'); return; }
  const btn = $('#scanBtn');
  btn.disabled = true; btn.textContent = t('scanning');
  try {
    const result = await api('/api/scan', { method: 'POST', body: { type: scanType, value } });
    lastScan = { value, result };
    renderResult();
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    loadStats();
  } catch (ex) {
    err.textContent = t('e_' + ex.code);
  } finally {
    btn.disabled = false; btn.textContent = t('scan_btn');
  }
}

/* ---------- Report ---------- */
function fillSelect(sel, items, prefix, { optional = false } = {}) {
  const current = sel.value;
  sel.innerHTML = `<option value="">${esc(optional ? t('f_none') : t('f_choose'))}</option>` +
    items.map((v) => `<option value="${esc(v)}">${esc(t(prefix + v))}</option>`).join('');
  sel.value = current;
}

function syncReportType() {
  const type = $('#rType').value;
  $('#rValueLabel').textContent = t('f_value_' + type);
  $('#rDescWrap').hidden = type === 'message';
  $('#rValue').rows = type === 'message' ? 4 : 1;
  $('#rValue').dir = type === 'message' ? 'auto' : 'ltr';
}

function prefillReport(type, value) {
  $('#rType').value = type;
  $('#rValue').value = value;
  syncReportType();
  location.hash = '#report';
}

async function doReport(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const body = Object.fromEntries(f.entries());
  const err = $('#reportError');
  err.textContent = '';
  if (!body.value.trim()) { err.textContent = t('e_empty_value'); return; }
  if (!body.category) { err.textContent = t('e_invalid_category'); return; }
  if (!body.channel) { err.textContent = t('e_invalid_channel'); return; }
  if (!body.emirate) delete body.emirate;
  const btn = $('#reportBtn');
  btn.disabled = true; btn.textContent = t('sending');
  try {
    const out = await api('/api/report', { method: 'POST', body });
    e.target.hidden = true;
    $('#reportOk').hidden = false;
    $('#redactedNote').hidden = !out.redacted;
  } catch (ex) {
    err.textContent = t('e_' + ex.code);
  } finally {
    btn.disabled = false; btn.textContent = t('submit_report');
  }
}

/* ---------- Registry ---------- */
async function loadRegistry(page = regPage) {
  regPage = page;
  const q = encodeURIComponent($('#regQ').value.trim());
  const type = $('#regType').value;
  const list = $('#regList');
  try {
    const data = await api(`/api/registry?q=${q}&type=${type}&page=${page}`);
    if (!data.items.length) {
      list.innerHTML = `<p class="empty">${esc(t('no_results'))}</p>`;
      $('#regPager').innerHTML = '';
      return;
    }
    list.innerHTML = data.items.map((it) => `
      <article class="reg-item st-${it.status}">
        <div class="reg-top">
          <span class="badge">${esc(t('t_' + it.type))}</span>
          <span class="status">${esc(t('st_' + it.status))}</span>
          <span class="muted">${esc(t('cat_' + it.category))}</span>
        </div>
        ${it.value ? `<p class="reg-value" dir="ltr">${esc(it.value)}</p>` : ''}
        ${it.sample ? `<p class="reg-sample" dir="auto">${esc(it.sample)}</p>` : ''}
        <div class="reg-foot"><span>${esc(t('reports_n', { n: fmtNum(it.reports) }))}</span><span>${esc(t('last_seen'))}: ${esc(fmtDate(it.last_seen))}</span></div>
      </article>`).join('');
    const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
    $('#regPager').innerHTML = pages > 1 ? `
      <button class="btn-ghost" ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">${esc(t('prev'))}</button>
      <span>${esc(t('page_of', { p: fmtNum(page), t: fmtNum(pages) }))}</span>
      <button class="btn-ghost" ${page >= pages ? 'disabled' : ''} data-p="${page + 1}">${esc(t('next'))}</button>` : '';
  } catch (ex) {
    list.innerHTML = `<p class="empty">${esc(t('e_' + ex.code))}</p>`;
  }
}

/* ---------- Init ---------- */
function relabel() {
  fillSelect($('#rCategory'), META.categories, 'cat_');
  fillSelect($('#rChannel'), META.channels, 'ch_');
  fillSelect($('#rEmirate'), META.emirates, 'em_', { optional: true });
  fillSelect($('#cPlatform'), META.platforms || [], 'pl_');
  fillSelect($('#cDemand'), META.demands || [], 'dm_');
  fillSelect($('#cEmirate'), META.emirates, 'em_', { optional: true });
  if (typeof renderGame === 'function') renderGame();
  syncReportType();
  renderResult();
  if (!$('#view-registry').hidden) loadRegistry();
  loadStats();
  renderScams();
}

document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();
  $('#langBtn').addEventListener('click', toggleLang);
  document.addEventListener('langchange', relabel);
  $$('#typeSeg button').forEach((b) => b.addEventListener('click', () => setScanType(b.dataset.type)));
  $$('[data-ex]').forEach((b) => b.addEventListener('click', () => {
    $('#scanInput').value = EXAMPLES[b.dataset.ex];
    setScanType('auto');
    $('#scanForm').requestSubmit();
  }));
  $('#scanForm').addEventListener('submit', doScan);
  $('#scanInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#scanForm').requestSubmit(); });
  $('#rType').addEventListener('change', syncReportType);
  $('#reportForm').addEventListener('submit', doReport);
  $('#reportAgain').addEventListener('click', () => {
    $('#reportForm').reset(); $('#reportForm').hidden = false; $('#reportOk').hidden = true; syncReportType();
  });
  $('#regForm').addEventListener('submit', (e) => { e.preventDefault(); loadRegistry(1); });
  $('#regType').addEventListener('change', () => loadRegistry(1));
  $('#regPager').addEventListener('click', (e) => { const p = e.target.closest('[data-p]'); if (p) loadRegistry(Number(p.dataset.p)); });
  window.addEventListener('hashchange', route);
  try { META = await api('/api/meta'); } catch { /* keep empty */ }
  relabel();
  route();
  setupMotion();
});
