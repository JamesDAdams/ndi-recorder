import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let DatabaseSync = null;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (e) {}

const DB_PATH = process.env.SETTINGS_DB || './settings.db';

let db = null;
let disabled = false;

function getDb() {
  if (disabled) return null;
  if (db) return db;
  if (!DatabaseSync) {
    disabled = true;
    console.error('[DB] SQLite unavailable — settings & logs will not be persisted');
    return null;
  }
  try {
    const dir = path.dirname(DB_PATH);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new DatabaseSync(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS api_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        query TEXT,
        ip TEXT
      );
      CREATE TABLE IF NOT EXISTS recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        filename TEXT NOT NULL,
        filePath TEXT,
        duration_s INTEGER NOT NULL,
        source TEXT,
        type TEXT,
        size_bytes INTEGER
      );
      CREATE TABLE IF NOT EXISTS replay_saves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        filename TEXT NOT NULL,
        filePath TEXT,
        minutes INTEGER NOT NULL,
        duration_s INTEGER NOT NULL,
        source TEXT,
        size_bytes INTEGER
      );
    `);
  } catch (e) {
    disabled = true;
    console.error(`[DB] SQLite unavailable (${e.message}) — settings & logs will not be persisted`);
  }
  return db;
}

export function loadSettings(key) {
  const database = getDb();
  if (!database) return null;
  try {
    const row = database.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : null;
  } catch (e) {
    console.warn(`[DB] loadSettings failed: ${e.message}`);
    return null;
  }
}

export function saveSettings(key, value) {
  const database = getDb();
  if (!database) return false;
  try {
    database.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`[DB] saveSettings failed: ${e.message}`);
    return false;
  }
}

export function logApiCall(entry) {
  const database = getDb();
  if (!database) return false;
  try {
    database.prepare('INSERT INTO api_logs (timestamp, method, path, query, ip) VALUES (?, ?, ?, ?, ?)')
      .run(entry.timestamp || new Date().toISOString(), entry.method || '', entry.path || '', entry.query || '', entry.ip || '');
    return true;
  } catch (e) {
    console.warn(`[DB] logApiCall failed: ${e.message}`);
    return false;
  }
}

export function insertRecording(entry) {
  const database = getDb();
  if (!database) return false;
  try {
    database.prepare('INSERT INTO recordings (timestamp, filename, filePath, duration_s, source, type, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(entry.timestamp || new Date().toISOString(), entry.filename || '', entry.filePath || '', entry.duration || 0, entry.source || '', entry.type || 'full', entry.sizeBytes || 0);
    return true;
  } catch (e) {
    console.warn(`[DB] insertRecording failed: ${e.message}`);
    return false;
  }
}

export function insertReplaySave(entry) {
  const database = getDb();
  if (!database) return false;
  try {
    database.prepare('INSERT INTO replay_saves (timestamp, filename, filePath, minutes, duration_s, source, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(entry.timestamp || new Date().toISOString(), entry.filename || '', entry.filePath || '', entry.minutes || 0, entry.duration || 0, entry.source || '', entry.sizeBytes || 0);
    return true;
  } catch (e) {
    console.warn(`[DB] insertReplaySave failed: ${e.message}`);
    return false;
  }
}

export function getApiLogs(limit = 100) {
  const database = getDb();
  if (!database) return [];
  try {
    return database.prepare('SELECT * FROM api_logs ORDER BY id DESC LIMIT ?').all(limit).map(r => ({ ...r }));
  } catch (e) {
    return [];
  }
}

export function getRecordings(limit = 100) {
  const database = getDb();
  if (!database) return [];
  try {
    return database.prepare('SELECT * FROM recordings ORDER BY id DESC LIMIT ?').all(limit).map(r => ({ ...r }));
  } catch (e) {
    return [];
  }
}

export function getReplaySaves(limit = 100) {
  const database = getDb();
  if (!database) return [];
  try {
    return database.prepare('SELECT * FROM replay_saves ORDER BY id DESC LIMIT ?').all(limit).map(r => ({ ...r }));
  } catch (e) {
    return [];
  }
}
