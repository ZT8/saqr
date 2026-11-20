'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

const config = { dbPath: ':memory:', adminUser: 'admin', adminPass: 'test-pass', hashSecret: 'x', sessionHours: 1, publicThreshold: 3 };
let server, base;

test.before(async () => {
  const { app } = createApp(config);
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('scan endpoint validates and scans', async () => {
  assert.equal((await post('/api/scan', { value: '' })).status, 400);
  const r = await (await post('/api/scan', { value: 'moi.gov.ae.fines-pay.com' })).json();
  assert.equal(r.level, 'dangerous');
});

test('report flow: redaction, dedupe, public threshold, admin verification, learning', async () => {
  const msg = 'البنك: ارسل رمز التحقق 445566 وبطاقتي 4111 1111 1111 1111 للمحتال 0509998877 scam-bank.xyz';
  const body = { type: 'message', value: msg, category: 'bank_otp', channel: 'sms', emirate: 'dubai' };
  const res = await post('/api/report', body);
  assert.equal(res.status, 201);
  const out = await res.json();
  assert.equal(out.redacted, true);
  assert.deepEqual(out.indicators.map((i) => i.type).sort(), ['message', 'phone', 'url']);

  assert.equal((await post('/api/report', body)).status, 409, 'same reporter, same day → duplicate');
  assert.equal((await post('/api/report', { ...body, category: 'nope' })).status, 400);

  // One report is below the public threshold: phone stays hidden.
  let reg = await (await fetch(base + '/api/registry?q=0509998877')).json();
  assert.equal(reg.total, 0);

  // Admin login required
  assert.equal((await fetch(base + '/api/admin/stats')).status, 401);
  assert.equal((await post('/api/admin/login', { username: 'admin', password: 'wrong' })).status, 401);
  const login = await post('/api/admin/login', { username: 'admin', password: 'test-pass' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const H = { cookie };

  const q = await (await fetch(base + '/api/admin/indicators?status=pending', { headers: H })).json();
  const msgInd = q.items.find((i) => i.type === 'message');
  assert.ok(msgInd.reports[0].content.includes('[CARD]'), 'stored content is redacted');
  assert.ok(!msgInd.reports[0].content.includes('4111'));
  const phoneInd = q.items.find((i) => i.type === 'phone');

  const v = await (await post(`/api/admin/indicators/${msgInd.id}/status`, { status: 'verified' }, H)).json();
  assert.equal(v.learned, true);
  assert.ok(v.model.samples > 0);
  await post(`/api/admin/indicators/${phoneInd.id}/status`, { status: 'verified' }, H);

  reg = await (await fetch(base + '/api/registry?q=0509998877')).json();
  assert.equal(reg.total, 1);
  assert.equal(reg.items[0].value, '+971509998877');

  const scan = await (await post('/api/scan', { value: '0509998877' })).json();
  assert.equal(scan.level, 'dangerous');
  assert.equal(scan.reasons[0].code, 'registry_verified');

  const stats = await (await fetch(base + '/api/admin/stats', { headers: H })).json();
  assert.equal(stats.totals.reports, 1);
  assert.ok(stats.model.learned >= 1);

  const csv = await (await fetch(base + '/api/admin/export.csv', { headers: H })).text();
  assert.ok(csv.includes('+971509998877'));
  const audit = await (await fetch(base + '/api/admin/audit', { headers: H })).json();
  assert.ok(audit.some((a) => a.action === 'set_status:verified'));
});
