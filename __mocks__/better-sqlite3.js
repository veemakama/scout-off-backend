/**
 * Manual Jest mock for better-sqlite3.
 * Provides a minimal in-memory SQL-like interface so tests can run without
 * the native binary (which requires a matching Node ABI).
 *
 * Supported operations:
 *  - events table  (INSERT OR IGNORE / SELECT)
 *  - indexer_state table (INSERT / SELECT)
 *  - schema_migrations table (INSERT / SELECT) — used by runMigrations()
 *  - sqlite_master SELECT — reports which tables have been "created"
 *  - PRAGMA table_info — returns column metadata for created tables
 */

// Column definitions for tables we understand, keyed by table name.
const TABLE_COLUMNS = {
  events: ['id', 'type', 'ledger', 'tx_hash', 'payload'],
  indexer_state: ['key', 'value'],
  schema_migrations: ['version', 'applied_at'],
  trial_offers: ['id', 'scout', 'player_id', 'details_uri', 'ledger', 'tx_hash', 'created_at'],
};

class Statement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql.trim();
  }

  run(...args) {
    const sql = this._sql.toUpperCase();

    if (sql.startsWith('INSERT OR IGNORE INTO EVENTS')) {
      const [type, ledger, txHash, payload] = args;
      if (!this._db._events.find((e) => e.tx_hash === txHash)) {
        this._db._events.push({ type, ledger, tx_hash: txHash, payload });
      }
    } else if (
      sql.startsWith('INSERT INTO INDEXER_STATE') ||
      sql.startsWith('INSERT OR REPLACE INTO INDEXER_STATE') ||
      sql.includes('ON CONFLICT(KEY) DO UPDATE SET VALUE')
    ) {
      const [key, value] = args;
      this._db._state.set(key, value);
    } else if (sql.startsWith('INSERT INTO SCHEMA_MIGRATIONS')) {
      const [version] = args;
      if (!this._db._migrations.has(version)) {
        this._db._migrations.set(version, Math.floor(Date.now() / 1000));
      }
    }

    return { changes: 1, lastInsertRowid: 0 };
  }

  get(...args) {
    const sql = this._sql.toUpperCase();

    if (sql.includes('INDEXER_STATE')) {
      const key = args[0];
      const value = this._db._state.get(key);
      return value !== undefined ? { value } : undefined;
    }

    if (sql.includes('SQLITE_MASTER') || sql.includes('SQLITE_SCHEMA')) {
      // SELECT name FROM sqlite_master WHERE type='table' AND name=?
      const tableName = (args[0] || '').toLowerCase();
      const created = this._db._createdTables.has(tableName);
      return created ? { name: tableName } : undefined;
    }

    if (sql.includes('SELECT COUNT(*)') && sql.includes('SCHEMA_MIGRATIONS')) {
      return { cnt: this._db._migrations.size };
    }

    return undefined;
  }

  all(...args) {
    const sql = this._sql.toUpperCase();

    if (sql.includes('FROM EVENTS')) {
      if (sql.includes('WHERE TYPE = ?')) {
        return this._db._events.filter((e) => e.type === args[0]);
      }
      return [...this._db._events];
    }

    if (sql.includes('FROM SCHEMA_MIGRATIONS')) {
      return Array.from(this._db._migrations.entries()).map(([version, applied_at]) => ({
        version,
        applied_at,
      }));
    }

    if (sql.startsWith('PRAGMA TABLE_INFO')) {
      // PRAGMA table_info(<tableName>)
      const match = this._sql.match(/PRAGMA\s+table_info\((\w+)\)/i);
      const tableName = match ? match[1].toLowerCase() : '';
      const cols = TABLE_COLUMNS[tableName] || [];
      return cols.map((name, cid) => ({ cid, name, type: 'TEXT', notnull: 0, dflt_value: null, pk: cid === 0 ? 1 : 0 }));
    }

    if (sql.includes('SELECT COUNT(*)')) {
      if (sql.includes('SCHEMA_MIGRATIONS')) {
        return [{ cnt: this._db._migrations.size }];
      }
    }

    return [];
  }
}

class Database {
  constructor(_path) {
    this._events = [];
    this._state = new Map();
    this._migrations = new Map();   // version → applied_at
    this._createdTables = new Set(['events', 'indexer_state']); // pre-existing tables
  }

  exec(sql) {
    // Parse CREATE TABLE statements so sqlite_master queries work.
    const createRe = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi;
    let m;
    while ((m = createRe.exec(sql)) !== null) {
      this._createdTables.add(m[1].toLowerCase());
    }
  }

  prepare(sql) {
    return new Statement(this, sql);
  }

  transaction(fn) {
    return (...args) => fn(...args);
  }

  close() {}
}

module.exports = Database;
