'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../src/app');
const { placeholderPng } = require('../src/seed');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saqr-'));
const config = { dbPath: ':memory:', adminUser: 'admin', adminPass: 'p', hashSecret: 'x', sessionHours: 1, publicThreshold: 3, evidenceDir: path.join(dir, 'evidence'), evidenceKey: '' };
let server, base, svc;

test.before(async () => {
  const a = createApp(config);
  svc = a.svc;
  await new Promise((r) => { server = a.app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const req = (p, method = 'GET', body, headers = {}) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
async function adminCookie() {
  const r = await req('/api/admin/login', 'POST', { username: 'admin', password: 'p' });
  return { cookie: r.headers.get('set-cookie').split(';')[0] };
}

test('extortion case: encrypted at rest, integrity hash, tracking, admin view, withdrawal', async () => {
  const png = placeholderPng(20, 20);
  const r = await req('/api/help/case', 'POST', {
    platform: 'instagram', demand: 'money', paid: 'no',
    description: 'He threatens to publish photos. My card 4111 1111 1111 1111', extorter: '@bad', contact: '',
    files: [{ name: 'shot.png', data: png.toString('base64') }],
  });
  assert.equal(r.status, 201);
  const { ref, code } = await r.json();
  assert.match(ref, /^SQR-/);

  // Stored file is ciphertext, not a PNG
  const files = fs.readdirSync(config.evidenceDir);
  assert.equal(files.length, 1);
  assert.notEqual(fs.readFileSync(path.join(config.evidenceDir, files[0])).subarray(1, 4).toString(), 'PNG');

  assert.equal((await req('/api/help/case/status', 'POST', { ref, code: 'WRONG-CODE' })).status, 404);
  const st = await (await req('/api/help/case/status', 'POST', { ref, code })).json();
  assert.equal(st.status, 'new');
  assert.equal(st.evidence, 1);

  // Rejects non-image/PDF payloads
  assert.equal((await req('/api/help/case/evidence', 'POST', { ref, code, files: [{ name: 'x.exe', data: Buffer.from('MZ....not allowed....').toString('base64') }] })).status, 400);

  const H = await adminCookie();
  const list = await (await req('/api/admin/cases', 'GET', null, H)).json();
  const c = list.items.find((x) => x.ref === ref);
  const detail = await (await req('/api/admin/cases/' + c.id, 'GET', null, H)).json();
  assert.ok(detail.details.description.includes('[CARD]'), 'victim card number redacted');
  assert.equal(detail.evidence[0].sha256.length, 64);
  const ev = await req(`/api/admin/cases/${c.id}/evidence/${detail.evidence[0].id}`, 'GET', null, H);
  assert.equal(ev.headers.get('x-evidence-integrity'), 'ok');
  assert.deepEqual(Buffer.from(await ev.arrayBuffer()), png);

  await req('/api/admin/cases/' + c.id, 'POST', { status: 'in_progress', note: 'We are on it' }, H);
  const st2 = await (await req('/api/help/case/status', 'POST', { ref, code })).json();
  assert.equal(st2.status, 'in_progress');
  assert.equal(st2.note, 'We are on it');
  const d2 = await (await req('/api/admin/cases/' + c.id, 'GET', null, H)).json();
  assert.ok(d2.custody.some((l) => l.action === 'evidence_viewed' && l.detail.includes('integrity:ok')));

  assert.equal((await req('/api/help/case/withdraw', 'POST', { ref, code })).status, 200);
  assert.equal(fs.readdirSync(config.evidenceDir).length, 0, 'evidence file erased');
  assert.equal((await req('/api/help/case/status', 'POST', { ref, code })).status, 404);
});

test('family protection: risky elder scan + help alert the guardian; safe scans do not', async () => {
  const fam = await (await req('/api/family', 'POST', { label: 'Mum' })).json();
  assert.ok(fam.qrSvg.startsWith('<svg'));
  assert.ok(fam.elderLink.includes('/elder#pair='));
  const E = { 'X-Elder-Token': fam.elderToken };
  const G = { 'X-Guardian-Token': fam.guardianToken };

  assert.equal((await (await req('/api/family/elder', 'GET', null, E)).json()).label, 'Mum');
  const safe = await (await req('/api/scan', 'POST', { value: 'Did you get home safely?' }, E)).json();
  assert.equal(safe.familyAlerted, false);
  const bad = await (await req('/api/scan', 'POST', { value: 'Your bank card is blocked, send the OTP code now to bank-unlock.xyz', share: false }, E)).json();
  assert.equal(bad.familyAlerted, true);
  await req('/api/family/help', 'POST', null, E);

  const al = await (await req('/api/family/alerts', 'GET', null, G)).json();
  assert.equal(al.items.length, 2);
  assert.equal(al.unseen, 2);
  assert.equal(al.items.find((a) => a.kind === 'scan').shared_text, null, 'text not shared without consent');
  assert.equal((await req('/api/family/alerts', 'GET', null, E)).status, 401, 'elder token cannot read alerts');

  await req('/api/family', 'DELETE', null, G);
  assert.equal((await req('/api/family/alerts', 'GET', null, G)).status, 401);
});

test('campaign radar groups template variants across domains and flags spikes; bulk verify', async () => {
  const now = Date.now();
  const tpl = (d) => `Emirates ID alert: you must update your details within 48 hours or your ID will be suspended ${d}`;
  const domains = ['id-renew-a.top', 'id-renew-b.sbs', 'uae-idcheck.click'];
  for (let i = 0; i < 9; i++) {
    svc.createReport({ type: 'message', value: tpl(domains[i % 3]), category: 'impersonation', channel: 'sms' }, { when: new Date(now - i * 3600e3).toISOString(), hash: 'h' + i });
  }
  svc.createReport({ type: 'message', value: 'Congratulations you won a prize, call now', category: 'prize', channel: 'sms' }, { hash: 'z1' });
  const H = await adminCookie();
  const camps = await (await req('/api/admin/campaigns', 'GET', null, H)).json();
  const c = camps.find((x) => x.domains.includes('id-renew-a.top'));
  assert.ok(c, 'campaign found');
  assert.deepEqual([...c.domains].sort(), [...domains].sort());
  assert.equal(c.reports, 9);
  assert.equal(c.spiking, true);
  const pend = c.indicators.filter((i) => i.status === 'pending').map((i) => i.id);
  const out = await (await req('/api/admin/campaigns/verify', 'POST', { indicatorIds: pend }, H)).json();
  assert.equal(out.verified, pend.length);
  const scan = await (await req('/api/scan', 'POST', { value: 'uae-idcheck.click' })).json();
  assert.equal(scan.level, 'dangerous');
});

test('training questions come with engine explanations', async () => {
  const qs = await (await req('/api/training?lang=en')).json();
  assert.equal(qs.length, 8);
  for (const q of qs) {
    assert.ok(['scam', 'safe'].includes(q.answer));
    assert.equal((q.analysis.level !== 'safe'), q.answer === 'scam', q.text);
  }
});

test('threat feeds and uploaded lists: exact matching, trusted hosts protected, scam phrases added live', async () => {
  const H = await adminCookie();
  // Uploaded list of scam numbers (e.g. from a telecom operator)
  const up = await (await req('/api/admin/sources/upload', 'POST', { name: 'Telecom scam numbers', type: 'phone', text: '+971 50 111 2233\n0559998877\nnot a number' }, H)).json();
  assert.equal(up.count, 2);
  const p = await (await req('/api/scan', 'POST', { value: '055 999 8877' })).json();
  assert.equal(p.level, 'dangerous');
  assert.equal(p.reasons[0].code, 'feed_listed');

  // URL list: a host-only entry on a trusted platform is ignored; a specific path is kept.
  await req('/api/admin/sources/upload', 'POST', { name: 'Police links', type: 'url', text: 'google.com\nhttps://sites.google.com/view/uae-fine-pay\nbad-portal-login.top' }, H);
  assert.equal((await (await req('/api/scan', 'POST', { value: 'https://google.com' })).json()).level, 'safe');
  assert.equal((await (await req('/api/scan', 'POST', { value: 'https://sites.google.com/view/uae-fine-pay' })).json()).level, 'dangerous');
  assert.equal((await (await req('/api/scan', 'POST', { value: 'https://sites.google.com/view/my-school' })).json()).reasons.some((r) => r.code === 'feed_listed'), false);
  assert.equal((await (await req('/api/scan', 'POST', { value: 'http://bad-portal-login.top/x' })).json()).reasons.some((r) => r.code === 'feed_listed'), true, 'host entry covers its paths');

  // Disabling a source stops its matches
  const src = (await (await req('/api/admin/sources', 'GET', null, H)).json()).feeds.find((f) => f.name === 'Telecom scam numbers');
  await req(`/api/admin/sources/${src.id}/enabled`, 'POST', { enabled: false }, H);
  assert.notEqual((await (await req('/api/scan', 'POST', { value: '055 999 8877' })).json()).reasons[0].code, 'feed_listed');

  // A new scam phrase added by the authority is used immediately
  const msg = 'عندك نقاط مكافأة بتنتهي الليلة';
  const before = await (await req('/api/scan', 'POST', { value: msg })).json();
  await req('/api/admin/terms', 'POST', { tactic: 'prize', term: 'نقاط مكافأة' }, H);
  await req('/api/admin/terms/import', 'POST', { text: 'urgency,بتنتهي الليلة' }, H);
  const after = await (await req('/api/scan', 'POST', { value: msg })).json();
  assert.ok(after.score > before.score);
  assert.ok(after.reasons.some((r) => r.code === 'tactic_prize'));
  assert.notEqual(after.level, 'safe');
});

test('feed download parses a remote list (mocked network)', async () => {
  const { openDb } = require('../src/db');
  const { makeFeeds } = require('../src/feeds');
  const db = openDb(':memory:');
  const feeds = makeFeeds(db, { fetchImpl: async () => ({ ok: true, text: async () => '# comment\nphish-one.xyz\nhttps://phish-two.top/login\n\n' }) });
  const r = await feeds.update('openphish');
  assert.equal(r.count, 2);
  assert.ok(feeds.lookup('url', 'phish-one.xyz'));
  assert.ok(feeds.lookup('url', 'phish-two.top/login'));
});
