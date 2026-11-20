'use strict';
// DEV ONLY: `npm run dev:fixtures` — serves Saqr with three datasets behind a toggle
// (Demo / Worst case / Empty). The dataset is chosen at the data boundary (a separate
// in-memory database per dataset), never by editing markup. Not used in production.

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const QRCode = require('qrcode');
const { createApp } = require('../src/app');
const { seedDemo } = require('../src/seed');
const { seedWorst } = require('./fixtures');

const base = { adminUser: 'admin', adminPass: 'saqr-demo-2026', hashSecret: 'dev', sessionHours: 8, publicThreshold: 3 };
const mk = (name) => createApp({ ...base, dbPath: ':memory:', evidenceDir: fs.mkdtempSync(path.join(os.tmpdir(), `saqr-${name}-`)) });

const apps = { demo: mk('demo'), worst: mk('worst'), empty: mk('empty') };
seedDemo(apps.demo.svc, apps.demo.db, { cases: apps.demo.cases });
apps.demo.svc.retrain();
const worstFamily = seedWorst(apps.worst.svc, apps.worst.db, { cases: apps.worst.cases, family: apps.worst.family });

const PAGES = { '/': 'index.html', '/index.html': 'index.html', '/family': 'family.html', '/elder': 'elder.html', '/dashboard': 'dashboard.html' };
const pick = (req) => {
  const q = new URL(req.url, 'http://x').searchParams.get('data');
  if (q && apps[q]) return q;
  const c = /(?:^|;\s*)saqr_data=(\w+)/.exec(req.headers.cookie || '');
  return c && apps[c[1]] ? c[1] : 'demo';
};

const front = express();
front.get('/dev/toggle.js', (req, res) => res.type('js').sendFile(path.join(__dirname, 'toggle.js')));
front.get('/dev/worst-family', async (req, res) => {
  const link = `${req.protocol}://${req.get('host')}/elder#pair=${worstFamily.elderToken}`;
  res.json({ token: worstFamily.guardianToken, label: 'الوالدة الغالية أم محمد حفظها الله ورعاها'.slice(0, 40), elderLink: link, qrSvg: await QRCode.toString(link, { type: 'svg', margin: 1 }) });
});
front.use((req, res, next) => {
  const ds = pick(req);
  res.set('Set-Cookie', `saqr_data=${ds}; Path=/; SameSite=Lax`);
  const page = PAGES[req.path];
  if (page) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', page), 'utf8')
      .replace('</body>', '  <script src="/dev/toggle.js"></script>\n</body>');
    return res.type('html').send(html);
  }
  apps[ds].app(req, res, next);
});

const port = Number(process.env.PORT || 3100);
front.listen(port, () => console.log(`[saqr dev fixtures] http://localhost:${port}/?data=worst  (demo | worst | empty)`));
