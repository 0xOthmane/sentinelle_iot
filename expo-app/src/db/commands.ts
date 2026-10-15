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
     ORDER BY created_at DESC`,
  );

  return rows.map(toCommand);
}

/** Commands that still need a (re)send, oldest first. */
export async function getReplayableCommands(): Promise<QueuedCommand[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<CommandRow>(
    `SELECT id, device, led, status, attempts, created_at
     FROM command_queue
     WHERE status IN ('pending', 'sent')
     ORDER BY created_at ASC`,
  );

  return rows.map(toCommand);
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
