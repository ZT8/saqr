'use strict';
// Encryption at rest for sensitive extortion-case data (AES-256-GCM).
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadKey(config) {
  if (config.evidenceKey) {
    const k = Buffer.from(config.evidenceKey, 'hex');
    if (k.length !== 32) throw new Error('EVIDENCE_KEY must be 64 hex characters');
    return k;
  }
  // Generate once and keep beside the evidence (outside the database).
  const keyFile = path.join(path.dirname(config.evidenceDir), 'evidence.key');
  fs.mkdirSync(path.dirname(keyFile), { recursive: true });
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
}

function makeVault(cfg) {
  const config = { ...cfg, evidenceDir: cfg.evidenceDir || path.join(require('os').tmpdir(), 'saqr-evidence') };
  const key = loadKey(config);
  fs.mkdirSync(config.evidenceDir, { recursive: true });

  function encrypt(buf) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([c.update(buf), c.final()]);
    return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data };
  }
  function decrypt({ iv, tag, data }) {
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(data), d.final()]);
  }
  /** Compact string form for small values stored in the DB: iv.tag.ciphertext (base64). */
  function seal(obj) {
    const e = encrypt(Buffer.from(JSON.stringify(obj), 'utf8'));
    return `${e.iv}.${e.tag}.${e.data.toString('base64')}`;
  }
  function open(str) {
    const [iv, tag, data] = String(str).split('.');
    return JSON.parse(decrypt({ iv, tag, data: Buffer.from(data, 'base64') }).toString('utf8'));
  }
  function writeFile(buf) {
    const e = encrypt(buf);
    const name = crypto.randomBytes(16).toString('hex') + '.bin';
    fs.writeFileSync(path.join(config.evidenceDir, name), e.data, { mode: 0o600 });
    return { file: name, iv: e.iv, tag: e.tag };
  }
  function readFile({ file, iv, tag }) {
    const data = fs.readFileSync(path.join(config.evidenceDir, path.basename(file)));
    return decrypt({ iv, tag, data });
  }
  function removeFile(file) {
    try { fs.unlinkSync(path.join(config.evidenceDir, path.basename(file))); } catch { /* already gone */ }
  }
  return { seal, open, writeFile, readFile, removeFile };
}

module.exports = { makeVault };
