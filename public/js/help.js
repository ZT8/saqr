'use strict';
/* global t, api, esc, $, $$, fmtDate, fmtNum */
// Extortion help: confidential case with encrypted evidence, tracking, withdrawal.

let CASE_FILES = [];
let LAST_CASE = null;

async function sha256Hex(buf) {
  try {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function collectFiles(input, listEl) {
  const files = [...input.files].slice(0, 5);
  const out = [];
  listEl.innerHTML = '';
  for (const f of files) {
    const buf = await readFile(f);
    const hash = await sha256Hex(buf);
    out.push({ name: f.name, data: toBase64(buf), size: f.size, hash });
    listEl.insertAdjacentHTML('beforeend', `<li><span dir="auto">${esc(f.name)}</span><span class="muted">${(f.size / 1024).toFixed(0)} KB</span>${hash ? `<code dir="ltr" title="SHA-256">${esc(t('fingerprint'))}: ${hash.slice(0, 16)}…</code>` : ''}</li>`);
  }
  return out;
}

function setCaseTab(which) {
  $$('#caseTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ct === which)));
  $('#caseForm').hidden = which !== 'new' || !!LAST_CASE;
  $('#caseOk').hidden = which !== 'new' || !LAST_CASE;
  $('#trackBox').hidden = which !== 'track';
}

async function submitCase(e) {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  const err = $('#caseError');
  err.textContent = '';
  if (!body.platform) return (err.textContent = t('e_invalid_platform'));
  if (!body.demand) return (err.textContent = t('e_invalid_demand'));
  if ((body.description || '').trim().length < 10) return (err.textContent = t('e_description_short'));
  if (!body.emirate) delete body.emirate;
  body.files = CASE_FILES.map(({ name, data }) => ({ name, data }));
  const btn = $('#caseBtn');
  btn.disabled = true; btn.textContent = t('sending');
  try {
    LAST_CASE = await api('/api/help/case', { method: 'POST', body });
    $('#okRef').textContent = LAST_CASE.ref;
    $('#okCode').textContent = LAST_CASE.code;
    e.target.reset();
    CASE_FILES = [];
    $('#cFileList').innerHTML = '';
    setCaseTab('new');
  } catch (ex) {
    err.textContent = t('e_' + ex.code);
  } finally {
    btn.disabled = false; btn.textContent = t('submit_case');
  }
}

let TRACK = null; // { ref, code }

function renderTrack(st) {
  const box = $('#trackResult');
  box.hidden = false;
  box.innerHTML = `
    <dl class="track-dl">
      <dt>${esc(t('case_ref'))}</dt><dd><code dir="ltr">${esc(st.ref)}</code></dd>
      <dt>${esc(t('case_status'))}</dt><dd><span class="case-st cs-${esc(st.status)}">${esc(t('cs_' + st.status))}</span></dd>
      <dt>${esc(t('case_evidence'))}</dt><dd>${fmtNum(st.evidence)}</dd>
      <dt>${esc(t('case_updated'))}</dt><dd>${esc(fmtDate(st.updated_at))}</dd>
    </dl>
    ${st.note ? `<div class="note-box"><strong>${esc(t('case_note'))}</strong><p dir="auto">${esc(st.note)}</p></div>` : ''}
    <label class="file-add"><span>${esc(t('add_evidence'))}</span>
      <input type="file" id="tFiles" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"></label>
    <ul class="file-list" id="tFileList"></ul>
    <p class="form-error" id="tErr" role="alert"></p>
    <div class="row-actions">
      <button class="btn-primary" type="button" id="tUpload">${esc(t('add_evidence'))}</button>
      <button class="btn-ghost danger-text" type="button" id="tWithdraw">${esc(t('withdraw'))}</button>
    </div>`;
  let files = [];
  $('#tFiles').addEventListener('change', async (e) => { files = await collectFiles(e.target, $('#tFileList')); });
  $('#tUpload').addEventListener('click', async () => {
    $('#tErr').textContent = '';
    if (!files.length) return ($('#tErr').textContent = t('e_no_files'));
    try {
      const s2 = await api('/api/help/case/evidence', { method: 'POST', body: { ...TRACK, files: files.map(({ name, data }) => ({ name, data })) } });
      renderTrack(s2);
    } catch (ex) { $('#tErr').textContent = t('e_' + ex.code); }
  });
  const w = $('#tWithdraw');
  w.addEventListener('click', async () => {
    if (!w.dataset.armed) { w.dataset.armed = '1'; w.textContent = t('withdraw_confirm'); return; }
    try {
      await api('/api/help/case/withdraw', { method: 'POST', body: TRACK });
      box.innerHTML = `<p>${esc(t('withdrawn'))}</p>`;
      TRACK = null;
    } catch (ex) { $('#tErr').textContent = t('e_' + ex.code); }
  });
}

async function submitTrack(e) {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target).entries());
  $('#trackError').textContent = '';
  try {
    const st = await api('/api/help/case/status', { method: 'POST', body });
    TRACK = { ref: body.ref, code: body.code };
    renderTrack(st);
  } catch (ex) {
    $('#trackError').textContent = t('e_' + ex.code);
    $('#trackResult').hidden = true;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Quick exit: leave immediately to a neutral page and drop this page from back-history.
  $('#quickExit').addEventListener('click', () => { location.replace('https://www.google.com/search?q=weather'); });
  $('#caseTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-ct]'); if (b) setCaseTab(b.dataset.ct); });
  $('#cFiles').addEventListener('change', async (e) => { CASE_FILES = await collectFiles(e.target, $('#cFileList')); });
  $('#caseForm').addEventListener('submit', submitCase);
  $('#trackForm').addEventListener('submit', submitTrack);
  $('#copyCase').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${t('case_ref')}: ${LAST_CASE.ref}\n${t('case_code')}: ${LAST_CASE.code}`);
      $('#copyCase').textContent = t('copied');
    } catch { /* clipboard unavailable */ }
  });
  document.addEventListener('langchange', () => { if (TRACK && !$('#trackResult').hidden) submitTrack({ preventDefault() {}, target: $('#trackForm') }); });
});
