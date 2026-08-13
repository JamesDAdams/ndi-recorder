import fs from 'node:fs';

// Force a dedicated test DB BEFORE any src module loads (ESM imports evaluate
// in order), so tests never write into the real ./settings.db even when run
// without the SETTINGS_DB env var (e.g. bare `node --test`).
const TEST_DB = process.env.SETTINGS_DB || './tmp_test_settings.db';
process.env.SETTINGS_DB = TEST_DB;
try { fs.unlinkSync(TEST_DB); } catch (e) {}
