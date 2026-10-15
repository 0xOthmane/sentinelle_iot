import { getDatabase } from '@/db/database';
import type { JournalItem } from '@/types';
import { getAllCommands } from '@/db/commands';

export async function addJournalEntry(
  type: string,
  device: string | null,
  message: string,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO journal (type, device, message, created_at)
     VALUES (?, ?, ?, ?)`,
    type,
    device,
    message,
    Math.floor(Date.now() / 1000),
  );
}

export async function listJournalItems(limit = 100): Promise<JournalItem[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id: number;
    type: string;
    message: string;
    created_at: number;
  }>(
    `SELECT id, type, message, created_at
     FROM journal
     ORDER BY created_at DESC
     LIMIT 80`,
  );

  const commands = await getAllCommands();

  const local: JournalItem[] = rows.map((row) => ({
    id: `j-${row.id}`,
    type: row.type,
    message: row.message,
    createdAt: row.created_at,
  }));

  const commandItems: JournalItem[] = commands.map((command) => ({
    id: `c-${command.id}`,
    type: 'command',
    message: `Veilleuse ${command.led ? 'ON' : 'OFF'} · ${command.status} · ${command.attempts} tentative(s)`,
    createdAt: command.createdAt,
  }));

  return [...local, ...commandItems]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}
