'use strict';
/* global t, applyI18n, toggleLang, api, esc, LANG */
// Simplified page for elderly relatives: big text, one button, spoken verdict, help button.
const $ = (s) => document.querySelector(s);
const KEY = 'saqr_elder';

// Pairing: the guardian's link carries the token in the URL fragment (never sent to the server in logs).
const m = location.hash.match(/pair=([\w-]+)/);
if (m) {
  try { localStorage.setItem(KEY, m[1]); } catch { /* ignore */ }
  history.replaceState(null, '', location.pathname);
}
let TOKEN = null;
try { TOKEN = localStorage.getItem(KEY); } catch { /* ignore */ }
let LABEL = null;
let LAST = null;

const headers = () => ({ 'Content-Type': 'application/json', ...(TOKEN ? { 'X-Elder-Token': TOKEN } : {}) });

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG === 'ar' ? 'ar-AE' : 'en-GB';
  const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith(LANG));
  if (voice) u.voice = voice;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

function renderPaired() {
  $('#paired').textContent = LABEL ? t('eld_paired', { label: LABEL }) : t('eld_unpaired');
  $('#paired').className = 'paired ' + (LABEL ? 'ok' : '');
  $('#shareWrap').hidden = !LABEL;
  $('#helpBtn').hidden = !LABEL;
}

function renderResult() {
  if (!LAST) return;
  const box = $('#eResult');
  const msg = t('eld_' + LAST.level);
  box.className = 'elder-result lvl-' + LAST.level;
  box.innerHTML = `<div class="big-verdict">${esc(t('level_' + LAST.level))}</div><p>${esc(msg)}</p>
    ${LAST.familyAlerted ? `<p class="told">${esc(t('eld_family_told'))}</p>` : ''}
    <button type="button" class="btn-ghost elder-listen" id="listen">${esc(t('eld_listen'))}</button>`;
  box.hidden = false;
  $('#listen').addEventListener('click', () => speak(`${t('level_' + LAST.level)}. ${msg}`));
}

async function check() {
  const value = $('#eInput').value.trim();
  if (!value) { $('#eInput').focus(); return; }
  const btn = $('#checkBtn');
  btn.disabled = true;
  try {
    LAST = await api('/api/scan', { method: 'POST', headers: headers(), body: { type: 'auto', value, share: $('#share').checked } });
    renderResult();
    speak(`${t('level_' + LAST.level)}. ${t('eld_' + LAST.level)}`);
    $('#eResult').scrollIntoView({ behavior: 'smooth' });
  } catch (ex) {
    $('#eResult').hidden = false;
    $('#eResult').className = 'elder-result';
    $('#eResult').textContent = t('e_' + ex.code);
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();
  $('#langBtn').addEventListener('click', toggleLang);
  document.addEventListener('langchange', () => { renderPaired(); renderResult(); });
  $('#checkBtn').addEventListener('click', check);
  $('#pasteBtn').addEventListener('click', async () => {
    try { $('#eInput').value = await navigator.clipboard.readText(); } catch { $('#eInput').focus(); }
  });
  $('#helpBtn').addEventListener('click', async () => {
    try {
      await api('/api/family/help', { method: 'POST', headers: headers() });
      $('#helpBtn').textContent = t('eld_help_sent');
      speak(t('eld_help_sent'));
      setTimeout(() => { $('#helpBtn').textContent = t('eld_help'); }, 5000);
    } catch { /* ignore */ }
  });
  if (TOKEN) {
    try { LABEL = (await api('/api/family/elder', { headers: headers() })).label; } catch { TOKEN = null; }
  }
  renderPaired();
});
