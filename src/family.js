'use strict';
// Family protection: a guardian pairs an elderly relative's device. Risky scans and
// "I need help" taps on the elder's device become alerts for the guardian.
// Both sides hold random bearer tokens; the server keeps only their SHA-256 hashes.

const crypto = require('crypto');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const token = () => crypto.randomBytes(24).toString('base64url');
const nowIso = () => new Date().toISOString();

function makeFamily(db) {
  const bad = (code, status = 400) => Object.assign(new Error(code), { code, status });

  function create(label) {
    const l = String(label || '').trim().slice(0, 40);
    if (!l) throw bad('label_required');
    const guardian = token();
    const elder = token();
    db.prepare('INSERT INTO family_circles (label, guardian_hash, elder_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(l, sha(guardian), sha(elder), nowIso());
    return { label: l, guardianToken: guardian, elderToken: elder };
  }

  const byGuardian = (t) => (t ? db.prepare('SELECT * FROM family_circles WHERE guardian_hash = ?').get(sha(t)) : null);
  const byElder = (t) => (t ? db.prepare('SELECT * FROM family_circles WHERE elder_hash = ?').get(sha(t)) : null);

  function requireGuardian(t) {
    const c = byGuardian(t);
    if (!c) throw bad('family_not_found', 401);
    return c;
  }

  function elderInfo(t) {
    const c = byElder(t);
    if (!c) throw bad('family_not_found', 401);
    return { label: c.label };
  }

  /** Called after an elder-device scan. Only non-safe results alert the guardian. */
  function onElderScan(t, result, { shareText = false, text = '' } = {}) {
    const c = byElder(t);
    if (!c || result.level === 'safe') return false;
    const tactics = (result.tactics || result.reasons.map((r) => r.code)).slice(0, 6).join(',');
    db.prepare(`INSERT INTO family_alerts (circle_id, kind, level, input_type, score, tactics, shared_text, created_at)
                VALUES (?, 'scan', ?, ?, ?, ?, ?, ?)`)
      .run(c.id, result.level, result.detectedType, result.score, tactics, shareText ? String(text).slice(0, 1000) : null, nowIso());
    return true;
  }

  function help(t) {
    const c = byElder(t);
    if (!c) throw bad('family_not_found', 401);
    db.prepare("INSERT INTO family_alerts (circle_id, kind, created_at) VALUES (?, 'help', ?)").run(c.id, nowIso());
    return { ok: true };
  }

  function alerts(t) {
    const c = requireGuardian(t);
    const items = db.prepare('SELECT id, kind, level, input_type, score, tactics, shared_text, seen, created_at FROM family_alerts WHERE circle_id = ? ORDER BY id DESC LIMIT 50').all(c.id)
      .map((a) => ({ ...a, tactics: a.tactics ? a.tactics.split(',') : [], seen: !!a.seen }));
    return { label: c.label, items, unseen: items.filter((a) => !a.seen).length };
  }

  function markSeen(t) {
    const c = requireGuardian(t);
    db.prepare('UPDATE family_alerts SET seen = 1 WHERE circle_id = ?').run(c.id);
    return { ok: true };
  }

  /** Right to erasure: removes the circle and every alert. */
  function remove(t) {
    const c = requireGuardian(t);
    db.prepare('DELETE FROM family_circles WHERE id = ?').run(c.id);
    return { ok: true };
  }

  return { create, elderInfo, onElderScan, help, alerts, markSeen, remove };
}

module.exports = { makeFamily };
