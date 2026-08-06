const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS tips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supporter_name TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    message TEXT,
    source TEXT DEFAULT 'kofi',
    external_id TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const setMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
const getMeta = db.prepare('SELECT value FROM meta WHERE key = ?');

function getGoal() {
  const row = getMeta.get('goal');
  return row ? parseFloat(row.value) : parseFloat(process.env.TIP_GOAL || '1000');
}

function setGoal(amount) {
  setMeta.run('goal', String(amount));
}

// Ko-fi sends a "kofi_transaction_id" — use it as the external_id to make
// webhook retries idempotent (Ko-fi will retry on non-200 responses).
const insertTip = db.prepare(`
  INSERT OR IGNORE INTO tips (supporter_name, amount, currency, message, source, external_id)
  VALUES (@supporter_name, @amount, @currency, @message, @source, @external_id)
`);

function addTip({ supporterName, amount, currency = 'USD', message = '', source = 'kofi', externalId }) {
  const result = insertTip.run({
    supporter_name: supporterName || 'Anonymous',
    amount,
    currency,
    message,
    source,
    external_id: externalId,
  });
  return result.changes > 0; // false if this was a duplicate webhook delivery
}

function getTotal() {
  const row = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM tips').get();
  return row.total;
}

function getLastSupporter() {
  return db.prepare('SELECT * FROM tips ORDER BY created_at DESC, id DESC LIMIT 1').get();
}

function getRecentSupporters(limit = 5) {
  return db.prepare('SELECT * FROM tips ORDER BY created_at DESC, id DESC LIMIT ?').all(limit);
}

function getSupporterCount() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM tips').get();
  return row.c;
}

// link_id is a short label like "kofi", "patreon", "discord", or an
// affiliate's caption text — capped defensively since it comes from a header.
const insertClick = db.prepare('INSERT INTO clicks (link_id) VALUES (?)');

function recordClick(linkId) {
  insertClick.run(String(linkId).slice(0, 120));
}

function getClickCounts() {
  return db.prepare(
    'SELECT link_id, COUNT(*) AS count FROM clicks GROUP BY link_id ORDER BY count DESC'
  ).all();
}

function getTotalClicks() {
  const row = db.prepare('SELECT COUNT(*) AS c FROM clicks').get();
  return row.c;
}

module.exports = {
  addTip,
  getTotal,
  getLastSupporter,
  getRecentSupporters,
  getSupporterCount,
  getGoal,
  setGoal,
  recordClick,
  getClickCounts,
  getTotalClicks,
};