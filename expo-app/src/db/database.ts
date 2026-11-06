import * as SQLite from 'expo-sqlite';

// Single-flight promises: concurrent callers share one native open and one
// migration run. On Android, overlapping openDatabaseAsync / prepareAsync
// calls crash the native module with NullPointerException, so nothing may
// run in parallel here.
let openPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!openPromise) {
    openPromise = SQLite.openDatabaseAsync('sentinelle.db').catch((error) => {
      // Allow a later retry instead of caching a rejection forever.
      openPromise = null;
      throw error;
    });
  }
  return openPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await openDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS measurements_cache (
      device TEXT NOT NULL,
      ts INTEGER NOT NULL,
      t REAL NOT NULL,
      h REAL NOT NULL,
      PRIMARY KEY (device, ts)
    );

    CREATE TABLE IF NOT EXISTS devices_cache (
      id TEXT PRIMARY KEY NOT NULL,
      group_name TEXT,
      status TEXT,
      last_seen INTEGER,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS command_queue (
      id TEXT PRIMARY KEY NOT NULL,
      device TEXT NOT NULL,
      led INTEGER NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      device TEXT,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS thresholds_cache (
      device TEXT PRIMARY KEY NOT NULL,
      t_min REAL NOT NULL,
      t_max REAL NOT NULL,
      h_min REAL,
      h_max REAL,
      hold_seconds INTEGER NOT NULL DEFAULT 60,
      dirty INTEGER NOT NULL DEFAULT 0,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  const thresholdColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(thresholds_cache)',
  );
  if (!thresholdColumns.some((column) => column.name === 'hold_seconds')) {
    await db.execAsync(
      'ALTER TABLE thresholds_cache ADD COLUMN hold_seconds INTEGER NOT NULL DEFAULT 60',
    );
    if (thresholdColumns.some((column) => column.name === 'hold_minutes')) {
      await db.execAsync(
        'UPDATE thresholds_cache SET hold_seconds = hold_minutes * 60',
      );
    }
  }

  return db;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Every query waits for the single migration run: no prepare may hit the
  // native module before the tables exist.
  if (!initPromise) {
    initPromise = openAndMigrate().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export async function initDatabase(): Promise<void> {
  await getDatabase();
}

let transactionChain: Promise<unknown> = Promise.resolve();

/**
 * Runs `task` inside a transaction, one at a time. withTransactionAsync is
 * not exclusive and cannot nest, so concurrent callers (live WS frames,
 * bulk refreshes, a reset) must queue instead of overlapping.
 */
export function runInTransaction<T>(
  task: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const run = transactionChain.then(async () => {
    const db = await getDatabase();
    let result!: T;
    await db.withTransactionAsync(async () => {
      result = await task(db);
    });
    return result;
  });
  transactionChain = run.catch(() => undefined);
  return run;
}
