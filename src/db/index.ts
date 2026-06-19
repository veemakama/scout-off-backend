import Database from 'better-sqlite3';
import config from '../config';
import { EventRecord, ContractEventType } from '../types';

// ─── Connection & schema ──────────────────────────────────────────────────────

let _db: Database.Database | null = null;

/**
 * Initialise the database connection and create tables.
 * Must be called once at application startup before any query helper is used.
 * Safe to call in tests with DB_PATH=:memory: set before import.
 */
export function initDb(): void {
  _db = new Database(config.dbPath);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      type      TEXT NOT NULL,
      ledger    INTEGER NOT NULL,
      tx_hash   TEXT NOT NULL UNIQUE,
      payload   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS indexer_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function getDb(): Database.Database {
  if (!_db) throw new Error('Database not initialised — call initDb() first');
  return _db;
}

// ─── State helpers ────────────────────────────────────────────────────────────

export function getLastLedger(): number {
  const row = getDb()
    .prepare('SELECT value FROM indexer_state WHERE key = ?')
    .get('last_ledger') as { value: string } | undefined;
  return row ? parseInt(row.value, 10) : 0;
}

export function setLastLedger(ledger: number): void {
  getDb().prepare(
    'INSERT INTO indexer_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run('last_ledger', String(ledger));
}

// ─── Query helpers ────────────────────────────────────────────────────────────

interface EventRow {
  type: string;
  payload: string;
}

export function getEvents(type?: ContractEventType): EventRecord[] {
  const db = getDb();
  const rows = type
    ? (db.prepare('SELECT * FROM events WHERE type = ? ORDER BY ledger ASC').all(type) as EventRow[])
    : (db.prepare('SELECT * FROM events ORDER BY ledger ASC').all() as EventRow[]);

  return rows.map((r) => ({
    source: config.contractId,
    type: r.type as ContractEventType,
    payload: JSON.parse(r.payload),
    contractAddress: config.contractId,
  }));
}
