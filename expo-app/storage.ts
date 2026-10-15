import * as SQLite from 'expo-sqlite';

export type CachedMeasurement = {
  device: string;
  ts: number;
  t: number;
  h: number;
};

export type QueuedCommand = {
  id: string;
  device: string;
  led: boolean;
  status: 'pending' | 'sent' | 'acked' | 'failed';
  attempts: number;
  createdAt: number;
};

let database: SQLite.SQLiteDatabase | null = null;

// ======================================================
// DATABASE
// ======================================================

export async function getDatabase() {
  if (!database) {
    database = await SQLite.openDatabaseAsync('sentinelle.db');
  }

  return database;
}

export async function initDatabase() {
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
  `);
}

// ======================================================
// COMMAND QUEUE
// ======================================================

export async function addCommand(
  command: QueuedCommand,
) {
  const db = await getDatabase();

  await db.runAsync(
    `
    INSERT OR REPLACE INTO command_queue
      (
        id,
        device,
        led,
        status,
        attempts,
        created_at
      )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    command.id,
    command.device,
    command.led ? 1 : 0,
    command.status,
    command.attempts,
    command.createdAt,
  );
}

export async function getPendingCommands() {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    device: string;
    led: number;
    status: 'pending' | 'sent' | 'acked' | 'failed';
    attempts: number;
    created_at: number;
  }>(
    `
    SELECT
      id,
      device,
      led,
      status,
      attempts,
      created_at
    FROM command_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    device: row.device,
    led: row.led === 1,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
  })) as QueuedCommand[];
}

export async function updateCommandStatus(
  id: string,
  status: 'pending' | 'sent' | 'acked' | 'failed',
) {
  const db = await getDatabase();

  await db.runAsync(
    `
    UPDATE command_queue
    SET status = ?
    WHERE id = ?
    `,
    status,
    id,
  );
}

export async function incrementCommandAttempts(
  id: string,
) {
  const db = await getDatabase();

  await db.runAsync(
    `
    UPDATE command_queue
    SET attempts = attempts + 1
    WHERE id = ?
    `,
    id,
  );
}

export async function getAllCommands() {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    device: string;
    led: number;
    status: 'pending' | 'sent' | 'acked' | 'failed';
    attempts: number;
    created_at: number;
  }>(
    `
    SELECT
      id,
      device,
      led,
      status,
      attempts,
      created_at
    FROM command_queue
    ORDER BY created_at DESC
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    device: row.device,
    led: row.led === 1,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
  })) as QueuedCommand[];
}

// ======================================================
// JOURNAL
// ======================================================

export async function addJournalEntry(
  type: string,
  device: string | null,
  message: string,
) {
  const db = await getDatabase();

  await db.runAsync(
    `
    INSERT INTO journal
      (type, device, message, created_at)
    VALUES (?, ?, ?, ?)
    `,
    type,
    device,
    message,
    Math.floor(Date.now() / 1000),
  );
}