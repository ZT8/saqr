// CLI: npm run seed [demo|worst|empty]  — wipes the dev database and loads a dataset.
// Demo logins (dev OTP is always 1234): admin 0500000001, merchant 0500000002,
// staff 0500000003, customer 0500000004.
const fs = require('fs');
const path = require('path');
const DB_FILE = process.env.AROUND_DB || path.join(__dirname, '..', 'data', 'around.db');
for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm']) if (fs.existsSync(f)) fs.unlinkSync(f);
const datasets = require('./datasets');
const name = process.argv[2] || 'demo';
datasets.load(name);
console.log(`Seeded ${name} data.`);
