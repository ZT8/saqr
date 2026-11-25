const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('./db');
const { h, auth, tierFor, HttpError } = require('./services/core');
const { UPLOAD_DIR } = require('./services/uploads');
const loyalty = require('./services/loyalty');
const payments = require('./services/payments');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true, payments: payments.isTest ? 'test' : 'live' }));
  api.use('/auth', require('./routes/auth').router);
  api.use('/', require('./routes/stores').router);
  api.use('/banners', require('./services/banners').tracking);
  api.use('/orders', require('./routes/orders'));
  api.use('/social', require('./routes/social'));
  api.use('/gifts', require('./routes/gifts'));
  api.use('/branch', require('./routes/branch'));
  api.use('/merchant', require('./routes/merchant'));
  const { admin, join } = require('./routes/admin');
  api.use('/admin', admin);
  api.use('/join', join);
  api.get('/loyalty', auth, h((req, res) => res.json({ tier: tierFor(req.user.id), cards: loyalty.cardsFor(req.user.id) })));
  // Dev-only data switch (Demo / Worst case / Empty). Never mounted in production.
  if (process.env.NODE_ENV !== 'production') {
    const datasets = require('./datasets');
    api.get('/dev/dataset', (_req, res) => res.json({ current: datasets.current(), options: datasets.OPTIONS }));
    api.post('/dev/dataset/:name', h((req, res) => res.json({ current: datasets.load(req.params.name) })));
  }
  api.use((_req, _res, next) => next(new HttpError(404, 'غير موجود')));
  app.use('/api', api);

  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

  // Built web apps (customer PWA, branch, merchant, admin, landing) – single SPA bundle.
  const WEB = path.join(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(WEB)) {
    app.use(express.static(WEB, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(WEB, 'index.html')));
  }

  // Errors -> JSON { error }
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'صار خطأ في الخادم، حاول مرة ثانية' : (err.code === 'LIMIT_FILE_SIZE' ? 'الصورة كبيرة (الحد 8 ميجا)' : err.message) });
  });
  return app;
}

module.exports = { createApp, db };
