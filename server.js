'use strict';
const config = require('./src/config');
const { createApp } = require('./src/app');
const { seedDemo } = require('./src/seed');

const { app, db, svc, cases } = createApp(config);

if (config.demoData && db.prepare('SELECT COUNT(*) c FROM reports').get().c === 0) {
  const n = seedDemo(svc, db, { cases });
  svc.retrain();
  console.log(`[saqr] demo data loaded (${n} reports). Set DEMO_DATA=false to start empty.`);
}

app.listen(config.port, () => {
  console.log(`[saqr] running on http://localhost:${config.port}`);
  console.log(`[saqr] authority dashboard: http://localhost:${config.port}/dashboard  (user: ${config.adminUser})`);
  if (!process.env.ADMIN_PASS) console.log('[saqr] using the demo admin password — set ADMIN_PASS in .env before any real deployment.');
});
