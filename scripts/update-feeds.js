'use strict';
// `npm run feeds:update` — download every enabled threat feed into the database now.
const config = require('../src/config');
const { openDb } = require('../src/db');
const { makeFeeds } = require('../src/feeds');

(async () => {
  const feeds = makeFeeds(openDb(config.dbPath));
  for (const r of await feeds.updateAll()) console.log(r.error ? `✗ ${r.id}: ${r.error}` : `✓ ${r.id}: ${r.count} entries`);
})();
