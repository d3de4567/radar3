// db.js
// Este arquivo cria (se ainda não existir) o banco de dados SQLite
// e define a estrutura das tabelas usadas pelo sistema.

const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  telegram_chat_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT,
  url TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'not_started',
  last_check_at TEXT,
  availability TEXT NOT NULL DEFAULT 'unknown',
  monitoring_active INTEGER NOT NULL DEFAULT 0,
  alert_active INTEGER NOT NULL DEFAULT 0,
  auto_start INTEGER NOT NULL DEFAULT 0,
  auto_open INTEGER NOT NULL DEFAULT 0,
  sound_alert INTEGER NOT NULL DEFAULT 1,
  show_notification INTEGER NOT NULL DEFAULT 1,
  sold_out_text TEXT,
  available_text TEXT,
  css_selector TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS event_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL,
  note TEXT,
  FOREIGN KEY(event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_history_event ON event_history(event_id);
`);

module.exports = db;
