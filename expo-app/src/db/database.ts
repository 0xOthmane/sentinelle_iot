import * as SQLite from 'expo-sqlite';

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!database) {
    database = await SQLite.openDatabaseAsync('sentinelle.db');
  }
  return database;
}

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();

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
      hold_minutes INTEGER NOT NULL,
      dirty INTEGER NOT NULL DEFAULT 0,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}
