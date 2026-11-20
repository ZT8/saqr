'use strict';
/* global t, api, esc, $, reasonText, fmtNum, LANG */
// Awareness game: scam or safe? Explanations come from the live engine.

const TRAIN = { questions: [], i: 0, score: 0, correct: 0, streak: 0, answered: null, done: false, lang: null };
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

async function startTraining() {
  Object.assign(TRAIN, { lastW: 0, questions: [], i: 0, score: 0, correct: 0, streak: 0, answered: null, done: false, lang: LANG });
  renderGame();
  try {
    TRAIN.questions = await api('/api/training?lang=' + LANG);
  } catch (ex) {
    $('#game').innerHTML = `<p class="empty">${esc(t('e_' + ex.code))}</p>`;
    return;
  }
  renderGame();
}

function badgeFor(ratio) {
  return ratio >= 0.87 ? 'falcon' : ratio >= 0.5 ? 'guard' : 'novice';
}

function answer(choice) {
  const q = TRAIN.questions[TRAIN.i];
  if (!q || TRAIN.answered) return;
  const ok = choice === q.answer;
  TRAIN.answered = { choice, ok };
  if (ok) {
    TRAIN.correct++;
    TRAIN.streak++;
    TRAIN.score += 10 + (TRAIN.streak >= 3 ? 5 : 0);
  } else {
    TRAIN.streak = 0;
  }
  renderGame();
}

function next() {
  TRAIN.answered = null;
  TRAIN.i++;
  if (TRAIN.i >= TRAIN.questions.length) {
    TRAIN.done = true;
    const best = store.get('saqr_best', 0);
    if (TRAIN.score > best) store.set('saqr_best', TRAIN.score);
  }
  renderGame();
}

function renderGame() {
  const g = $('#game');
  if (!g) return;
  if (TRAIN.lang && TRAIN.lang !== LANG && !TRAIN.done) { startTraining(); return; } // new language → new question set
  if (!TRAIN.questions.length) { g.innerHTML = '<div class="game-loading"></div>'; return; }
  const total = TRAIN.questions.length;
  const hud = `<div class="hud"><span>${esc(t('question_n', { n: fmtNum(Math.min(TRAIN.i + 1, total)), t: fmtNum(total) }))}</span>
    <span>${esc(t('points'))}: <b>${fmtNum(TRAIN.score)}</b></span><span>${esc(t('streak'))}: <b>${fmtNum(TRAIN.streak)}</b></span></div>
    <div class="progress"><span data-w="${((TRAIN.i + (TRAIN.answered ? 1 : 0)) / total) * 100}"></span></div>`;

  if (TRAIN.done) {
    const ratio = TRAIN.correct / total;
    const b = badgeFor(ratio);
    g.innerHTML = `${hud}<div class="finish">
      <div class="badge-big b-${b}">${esc(t('badge_' + b))}</div>
      <h2>${esc(t('finish_t'))}</h2>
      <p>${esc(t('finish_d', { c: fmtNum(TRAIN.correct), t: fmtNum(total) }))} · ${esc(t('points'))}: <b>${fmtNum(TRAIN.score)}</b></p>
      <p class="muted">${esc(t('badge_' + b + '_d'))} · ${esc(t('best'))}: ${fmtNum(store.get('saqr_best', 0))}</p>
      <button class="btn-primary" type="button" id="again">${esc(t('play_again'))}</button></div>`;
    $('#again').addEventListener('click', startTraining);
  } else {
    const q = TRAIN.questions[TRAIN.i];
    const a = TRAIN.answered;
    let feedback = '';
    if (a) {
      const reasons = q.analysis.reasons.filter((r) => r.severity !== 'info').slice(0, 4);
      const ent = (q.analysis.entities || []).flatMap((e) => e.reasons).filter((r) => ['high', 'medium'].includes(r.severity)).slice(0, 2);
      feedback = `<div class="feedback ${a.ok ? 'ok' : 'bad'}">
        <h3>${esc(a.ok ? t('correct') : t('wrong'))} — ${esc(q.answer === 'scam' ? t('it_was_scam') : t('it_was_safe'))}</h3>
        <ul class="reasons">${[...reasons, ...ent].map((r) => `<li class="sev-${esc(r.severity)}"><span class="dot"></span><span>${esc(reasonText(r))}</span></li>`).join('')}</ul>
        <button class="btn-primary" type="button" id="nextQ">${esc(t('next_q'))}</button></div>`;
    }
    g.innerHTML = `${hud}
      <div class="bubble" dir="auto">${esc(q.text)}</div>
      <div class="choices">
        <button type="button" class="choice scam ${a && a.choice === 'scam' ? 'picked' : ''}" data-c="scam" ${a ? 'disabled' : ''}>${esc(t('is_scam'))}</button>
        <button type="button" class="choice safe ${a && a.choice === 'safe' ? 'picked' : ''}" data-c="safe" ${a ? 'disabled' : ''}>${esc(t('is_safe'))}</button>
      </div>${feedback}`;
    g.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => answer(b.dataset.c)));
    $('#nextQ')?.addEventListener('click', next);
    $('#nextQ')?.focus();
  }
  // CSP-safe progress width
  // The bar is re-rendered each step: start it at the previous value, then move, so it glides.
  g.querySelectorAll('[data-w]').forEach((el) => {
    const to = Number(el.dataset.w) / 100;
    el.style.transform = `scaleX(${(TRAIN.lastW || 0).toFixed(3)})`;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = `scaleX(${to.toFixed(3)})`; }));
    TRAIN.lastW = to;
  });
}
