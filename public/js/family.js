'use strict';
/* global t, applyI18n, toggleLang, api, esc, fmtDate, fmtNum */
const $ = (s) => document.querySelector(s);
const KEY = 'saqr_guardian';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const save = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

let G = load(); // { token, label, elderLink, qrSvg }
let DATA = null;
let lastUnseen = 0;
let timer = null;

const famApi = (path, opts = {}) => api(path, { ...opts, headers: { 'Content-Type': 'application/json', 'X-Guardian-Token': G.token } });

function view() {
  $('#famCreate').hidden = !!G;
  $('#alertsBox').hidden = !G;
  if (G) {
    $('#pairTitle').textContent = t('fam_pair_t', { label: G.label });
    $('#pairLink').textContent = G.elderLink;
    $('#qr').innerHTML = G.qrSvg; // SVG produced by our own server (qrcode lib), no scripts
  }
  renderAlerts();
}

function renderAlerts() {
  if (!G || !DATA) return;
  const u = $('#unseen');
  u.hidden = !DATA.unseen;
  u.textContent = fmtNum(DATA.unseen);
  $('#alerts').innerHTML = DATA.items.length ? DATA.items.map((a) => {
    const text = a.kind === 'help'
      ? t('al_help', { label: DATA.label })
      : t('al_scan', { label: DATA.label, type: t('t_' + a.input_type), level: t('level_' + a.level) });
    const TACTICS = ['credentials', 'prize', 'payment', 'threat', 'urgency', 'impersonation', 'investment', 'job', 'parcel', 'personal_data', 'off_platform', 'new_number'];
    const label = (x) => (TACTICS.includes(x) ? t('r_tactic_' + x) : t('r_' + x)).replace(/\s*\([^)]*\)/g, '').replace(/"\{?\w*\}?"/g, '').replace(/\{\w+\}/g, '').trim();
    const tactics = a.tactics.filter((x) => !['uae_mobile', 'uae_landline', 'ml_normal_language'].includes(x)).slice(0, 4);
    return `<li class="alert-item ${a.kind === 'help' ? 'help' : 'lvl-' + esc(a.level)} ${a.seen ? '' : 'unseen'}">
      <div class="alert-top"><strong>${esc(text)}</strong>${a.score != null ? `<span class="pill lvl-${esc(a.level)}">${fmtNum(a.score)}</span>` : ''}</div>
      ${tactics.length ? `<ul class="alert-tactics">${tactics.map((x) => `<li>${esc(label(x))}</li>`).join('')}</ul>` : ''}
      ${a.shared_text ? `<div class="shared"><span class="muted">${esc(t('al_shared'))}</span><p dir="auto">${esc(a.shared_text)}</p></div>` : ''}
      <time class="muted">${esc(fmtDate(a.created_at))}</time></li>`;
  }).join('') : `<li class="empty">${esc(t('fam_none'))}</li>`;
}

async function poll() {
  if (!G) return;
  try {
    DATA = await famApi('/api/family/alerts');
    if (DATA.unseen > lastUnseen && 'Notification' in window && Notification.permission === 'granted') {
      const a = DATA.items.find((x) => !x.seen);
      new Notification(t('notif_title'), { body: a.kind === 'help' ? t('al_help', { label: DATA.label }) : t('al_scan', { label: DATA.label, type: t('t_' + a.input_type), level: t('level_' + a.level) }), icon: '/img/logo.svg' });
    }
    lastUnseen = DATA.unseen;
    renderAlerts();
  } catch (ex) {
    if (ex.status === 401) { G = null; save(null); view(); }
  }
}

function startPolling() {
  clearInterval(timer);
  if (!G) return;
  poll();
  timer = setInterval(poll, 10000);
}

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  $('#langBtn').addEventListener('click', toggleLang);
  document.addEventListener('langchange', view);
  $('#famCreate').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#famError').textContent = '';
    try {
      const out = await api('/api/family', { method: 'POST', body: { label: new FormData(e.target).get('label') } });
      G = { token: out.guardianToken, label: out.label, elderLink: out.elderLink, qrSvg: out.qrSvg };
      save(G);
      $('#pairBox').hidden = false;
      view();
      startPolling();
    } catch (ex) { $('#famError').textContent = t('e_' + ex.code); }
  });
  $('#copyLink').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(G.elderLink); $('#copyLink').textContent = t('copied'); } catch { /* ignore */ }
  });
  $('#showLink').addEventListener('click', () => { $('#pairBox').hidden = !$('#pairBox').hidden; });
  $('#notifBtn').addEventListener('click', async () => {
    if ('Notification' in window) await Notification.requestPermission();
    $('#notifBtn').hidden = 'Notification' in window && Notification.permission === 'granted';
  });
  $('#notifBtn').hidden = !('Notification' in window) || Notification.permission === 'granted';
  $('#seenBtn').addEventListener('click', async () => { await famApi('/api/family/seen', { method: 'POST' }).catch(() => {}); lastUnseen = 0; poll(); });
  const un = $('#unlink');
  un.addEventListener('click', async () => {
    if (!un.dataset.armed) { un.dataset.armed = '1'; un.textContent = t('fam_delete_confirm'); return; }
    await famApi('/api/family', { method: 'DELETE' }).catch(() => {});
    G = null; save(null); DATA = null; clearInterval(timer);
    $('#pairBox').hidden = true;
    un.dataset.armed = ''; un.textContent = t('fam_delete');
    view();
  });
  view();
  startPolling();
});
