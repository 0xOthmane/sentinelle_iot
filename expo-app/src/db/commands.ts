import { getDatabase } from '@/db/database';

export type CommandStatus = 'pending' | 'sent' | 'acked' | 'failed';

export type QueuedCommand = {
  id: string;
  device: string;
  led: boolean;
  status: CommandStatus;
  attempts: number;
  createdAt: number;
};

type CommandRow = {
  id: string;
  device: string;
  led: number;
  status: CommandStatus;
  attempts: number;
  created_at: number;
};

function toCommand(row: CommandRow): QueuedCommand {
  return {
    id: row.id,
    device: row.device,
    led: row.led === 1,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
  };
}

export async function addCommand(command: QueuedCommand): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO command_queue
      (id, device, led, status, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    command.id,
    command.device,
    command.led ? 1 : 0,
    command.status,
    command.attempts,
    command.createdAt,
  );
}

export async function getAllCommands(): Promise<QueuedCommand[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<CommandRow>(
    `SELECT id, device, led, status, attempts, created_at
     FROM command_queue
     ORDER BY created_at DESC, rowid DESC`,
  );

  return rows.map(toCommand);
}

/**
 * The command to (re)send on reconnect: only the newest pending one. Older
 * pending commands are superseded (the LED only needs its latest target
 * state) and marked failed so they are never replayed.
 */
export async function takeLatestPendingCommand(): Promise<QueuedCommand | null> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<CommandRow>(
    `SELECT id, device, led, status, attempts, created_at
     FROM command_queue
     WHERE status = 'pending'
     ORDER BY created_at DESC, rowid DESC`,
  );
  if (!rows.length) return null;

  const [latest, ...superseded] = rows;
  for (const row of superseded) {
    await db.runAsync(
      `UPDATE command_queue SET status = 'failed' WHERE id = ?`,
      row.id,
    );
  }
  return toCommand(latest);
}

const MAX_QUEUE_ROWS = 100;

/** Keeps the queue (read on every journal refresh) from growing forever. */
export async function pruneCommands(): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM command_queue
     WHERE status != 'pending'
       AND id NOT IN (
         SELECT id FROM command_queue
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?
       )`,
    MAX_QUEUE_ROWS,
  );
}

export async function updateCommandStatus(
  id: string,
  status: CommandStatus,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE command_queue SET status = ? WHERE id = ?`,
    status,
    id,
  );
}

export async function incrementCommandAttempts(id: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE command_queue SET attempts = attempts + 1 WHERE id = ?`,
    id,
  );
}
