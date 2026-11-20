'use strict';
// Scam phrases the authority adds from the dashboard (e.g. new wording seen in the wild).
// They are merged into the engine's tactic rules immediately, no restart needed.

const { TACTICS, setCustomTerms } = require('./engine/message');

function makeTerms(db) {
  const bad = (code) => Object.assign(new Error(code), { code, status: 400 });
  const reload = () => setCustomTerms(db.prepare('SELECT tactic, term FROM custom_terms').all());
  reload();

  function add(tactic, term, admin) {
    if (!TACTICS[tactic]) throw bad('invalid_tactic');
    const t = String(term || '').trim().replace(/\s+/g, ' ');
    if (t.length < 2 || t.length > 80) throw bad('invalid_term');
    db.prepare('INSERT OR IGNORE INTO custom_terms (tactic, term, added_by, created_at) VALUES (?, ?, ?, ?)').run(tactic, t, admin, new Date().toISOString());
    reload();
    return { tactic, term: t };
  }

  /** Bulk import: one "tactic,phrase" per line (lines without a known tactic use the default). */
  function importText(text, admin, defaultTactic = 'call_to_action') {
    let added = 0, skipped = 0;
    const tx = db.transaction(() => {
      for (const raw of String(text || '').split(/\r?\n/).slice(0, 5000)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const i = line.indexOf(',');
        let tactic = i > 0 ? line.slice(0, i).trim() : defaultTactic;
        let term = i > 0 ? line.slice(i + 1).trim() : line;
        if (!TACTICS[tactic]) { term = line; tactic = defaultTactic; }
        term = term.replace(/^"|"$/g, '').replace(/\s+/g, ' ');
        if (term.length < 2 || term.length > 80) { skipped++; continue; }
        const r = db.prepare('INSERT OR IGNORE INTO custom_terms (tactic, term, added_by, created_at) VALUES (?, ?, ?, ?)').run(tactic, term, admin, new Date().toISOString());
        r.changes ? added++ : skipped++;
      }
    });
    tx();
    reload();
    return { added, skipped };
  }

  function remove(id) {
    db.prepare('DELETE FROM custom_terms WHERE id = ?').run(id);
    reload();
    return { ok: true };
  }

  const list = () => db.prepare('SELECT id, tactic, term, added_by, created_at FROM custom_terms ORDER BY tactic, term').all();
  const tactics = () => Object.keys(TACTICS);

  return { add, importText, remove, list, tactics };
}

module.exports = { makeTerms };
