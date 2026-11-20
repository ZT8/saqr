'use strict';
// Extortion support: anonymous, encrypted cases with an evidence vault and chain of custody.

const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('./security');
const { redact } = require('./engine');

const PLATFORMS = ['instagram', 'snapchat', 'whatsapp', 'tiktok', 'telegram', 'x', 'facebook', 'other'];
const DEMANDS = ['money', 'more_images', 'meeting', 'other'];
const CASE_STATUS = ['new', 'in_progress', 'closed'];
const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

const nowIso = () => new Date().toISOString();
const randStr = (n) => Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join('');

function sniffMime(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 4) === '%PDF') return 'application/pdf';
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  return null;
}

function makeCases(db, vault) {
  const bad = (code, status = 400) => Object.assign(new Error(code), { code, status });
  const log = db.prepare('INSERT INTO custody_log (case_id, actor, action, detail, created_at) VALUES (?, ?, ?, ?, ?)');

  function parseFiles(files) {
    if (!files) return [];
    if (!Array.isArray(files) || files.length > MAX_FILES) throw bad('too_many_files');
    return files.map((f) => {
      const b64 = String(f.data || '').replace(/^data:[^,]*,/, '');
      const buf = Buffer.from(b64, 'base64');
      if (!buf.length || buf.length > MAX_FILE_BYTES) throw bad('file_too_large');
      const mime = sniffMime(buf);
      if (!mime) throw bad('file_type');
      return { buf, mime, name: String(f.name || 'evidence').slice(0, 120) };
    });
  }

  function storeFiles(caseId, files, actor) {
    const ins = db.prepare(`INSERT INTO evidence (case_id, mime, size, sha256, name_enc, iv, tag, file, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const f of files) {
      const sha = crypto.createHash('sha256').update(f.buf).digest('hex');
      const w = vault.writeFile(f.buf);
      const info = ins.run(caseId, f.mime, f.buf.length, sha, vault.seal(f.name), w.iv, w.tag, w.file, nowIso());
      log.run(caseId, actor, 'evidence_received', `#${info.lastInsertRowid} sha256:${sha}`, nowIso());
    }
  }

  function create(input) {
    if (!PLATFORMS.includes(input.platform)) throw bad('invalid_platform');
    if (!DEMANDS.includes(input.demand)) throw bad('invalid_demand');
    const description = String(input.description || '').trim().slice(0, 3000);
    if (description.length < 10) throw bad('description_short');
    const files = parseFiles(input.files);
    const ref = 'SQR-' + randStr(6);
    const code = randStr(4) + '-' + randStr(4);
    const { hash, salt } = hashPassword(code);
    const details = {
      // The victim's own PII is redacted from the free text; contact is kept only if they chose to give it.
      description: redact(description).text,
      extorter: String(input.extorter || '').slice(0, 200),
      contact: String(input.contact || '').slice(0, 200),
    };
    const tx = db.transaction(() => {
      const info = db.prepare(`INSERT INTO cases (ref, access_hash, access_salt, platform, demand, paid, emirate, details_enc, created_at, updated_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(ref, hash, salt, input.platform, input.demand, input.paid === true || input.paid === 'yes' ? 1 : 0,
          input.emirate || null, vault.seal(details), nowIso(), nowIso());
      const id = Number(info.lastInsertRowid);
      log.run(id, 'victim', 'case_created', null, nowIso());
      storeFiles(id, files, 'victim');
      return id;
    });
    tx();
    return { ref, code, files: files.length };
  }

  function auth(ref, code) {
    const row = db.prepare('SELECT * FROM cases WHERE ref = ?').get(String(ref || '').trim().toUpperCase());
    if (!row || !verifyPassword(String(code || '').trim().toUpperCase(), row.access_salt, row.access_hash)) throw bad('case_not_found', 404);
    return row;
  }

  function status(ref, code) {
    const c = auth(ref, code);
    const n = db.prepare('SELECT COUNT(*) n FROM evidence WHERE case_id = ?').get(c.id).n;
    return { ref: c.ref, status: c.status, note: c.public_note, evidence: n, created_at: c.created_at, updated_at: c.updated_at };
  }

  function addEvidence(ref, code, files) {
    const c = auth(ref, code);
    const parsed = parseFiles(files);
    const existing = db.prepare('SELECT COUNT(*) n FROM evidence WHERE case_id = ?').get(c.id).n;
    if (!parsed.length) throw bad('no_files');
    if (existing + parsed.length > MAX_FILES * 2) throw bad('too_many_files');
    db.transaction(() => {
      storeFiles(c.id, parsed, 'victim');
      db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(nowIso(), c.id);
    })();
    return status(ref, code);
  }

  /** The victim can withdraw the case: everything, including the encrypted files, is erased. */
  function withdraw(ref, code) {
    const c = auth(ref, code);
    for (const e of db.prepare('SELECT file FROM evidence WHERE case_id = ?').all(c.id)) vault.removeFile(e.file);
    db.prepare('DELETE FROM cases WHERE id = ?').run(c.id);
    db.prepare('INSERT INTO audit_log (admin, action, target, created_at) VALUES (?, ?, ?, ?)').run('victim', 'case_withdrawn', c.ref, nowIso());
    return { ok: true };
  }

  // ----- Authority side -----
  function list({ status: st = '' } = {}) {
    const where = CASE_STATUS.includes(st) ? 'WHERE status = @st' : '';
    return db.prepare(`SELECT c.id, c.ref, c.status, c.platform, c.demand, c.paid, c.emirate, c.created_at, c.updated_at,
                         (SELECT COUNT(*) FROM evidence e WHERE e.case_id = c.id) evidence
                       FROM cases c ${where} ORDER BY (c.status='new') DESC, c.created_at DESC LIMIT 100`).all({ st });
  }

  function get(id, admin) {
    const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
    if (!c) throw bad('not_found', 404);
    log.run(id, admin, 'case_opened', null, nowIso());
    const ev = db.prepare('SELECT id, mime, size, sha256, name_enc, created_at FROM evidence WHERE case_id = ? ORDER BY id').all(id)
      .map(({ name_enc, ...e }) => ({ ...e, name: vault.open(name_enc) }));
    const custody = db.prepare('SELECT actor, action, detail, created_at FROM custody_log WHERE case_id = ? ORDER BY id DESC LIMIT 50').all(id);
    const { access_hash, access_salt, details_enc, ...pub } = c;
    return { ...pub, details: vault.open(details_enc), evidence: ev, custody };
  }

  function evidenceFile(id, eid, admin) {
    const e = db.prepare('SELECT * FROM evidence WHERE id = ? AND case_id = ?').get(eid, id);
    if (!e) throw bad('not_found', 404);
    const buf = vault.readFile(e);
    const actual = crypto.createHash('sha256').update(buf).digest('hex');
    const intact = actual === e.sha256;
    log.run(id, admin, 'evidence_viewed', `#${eid} integrity:${intact ? 'ok' : 'MISMATCH'}`, nowIso());
    return { buf, mime: e.mime, sha256: e.sha256, intact, name: vault.open(e.name_enc) };
  }

  function update(id, { status: st, note }, admin) {
    const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
    if (!c) throw bad('not_found', 404);
    if (st !== undefined && !CASE_STATUS.includes(st)) throw bad('invalid_status');
    const newStatus = st ?? c.status;
    const newNote = note === undefined ? c.public_note : String(note).slice(0, 1000);
    db.prepare('UPDATE cases SET status = ?, public_note = ?, updated_at = ? WHERE id = ?').run(newStatus, newNote, nowIso(), id);
    if (newStatus !== c.status) log.run(id, admin, 'status:' + newStatus, null, nowIso());
    if (newNote !== c.public_note) log.run(id, admin, 'note_updated', null, nowIso());
    return { id, status: newStatus, note: newNote };
  }

  function counts() {
    return Object.fromEntries(db.prepare('SELECT status k, COUNT(*) c FROM cases GROUP BY status').all().map((r) => [r.k, r.c]));
  }

  return { create, status, addEvidence, withdraw, list, get, evidenceFile, update, counts };
}

module.exports = { makeCases, PLATFORMS, DEMANDS, sniffMime };
