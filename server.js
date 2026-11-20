'use strict';
const config = require('./src/config');
const { createApp } = require('./src/app');
const { seedDemo } = require('./src/seed');

const { app, db, svc, cases, feeds } = createApp(config);

if (config.demoData && db.prepare('SELECT COUNT(*) c FROM reports').get().c === 0) {
  const n = seedDemo(svc, db, { cases });
  svc.retrain();
  console.log(`[saqr] demo data loaded (${n} reports). Set DEMO_DATA=false to start empty.`);
}

// Threat feeds: refresh in the background (never blocks start-up; failures are logged, not fatal).
async function refreshFeeds() {
  const res = await feeds.updateAll();
  for (const r of res) console.log(`[saqr] feed ${r.id}: ${r.error ? 'failed (' + r.error + ')' : r.count + ' entries'}`);
}
if (config.feedRefreshHours > 0) {
  const neverRun = feeds.list().every((f) => !f.last_run);
  if (neverRun) refreshFeeds();
  setInterval(refreshFeeds, config.feedRefreshHours * 3600e3).unref();
}

app.listen(config.port, () => {
  console.log(`[saqr] running on http://localhost:${config.port}`);
  console.log(`[saqr] authority dashboard: http://localhost:${config.port}/dashboard  (user: ${config.adminUser})`);
  if (!process.env.ADMIN_PASS) console.log('[saqr] using the demo admin password — set ADMIN_PASS in .env before any real deployment.');
});
