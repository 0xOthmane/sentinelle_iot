import { getDatabase } from '@/db/database';
import type { JournalItem } from '@/types';

const MAX_JOURNAL_ROWS = 200;

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

/** The journal is read after almost every event: keep it bounded. */
export async function pruneJournal(): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM journal
     WHERE id NOT IN (
       SELECT id FROM journal ORDER BY id DESC LIMIT ?
     )`,
    MAX_JOURNAL_ROWS,
  );
}

export async function listJournalItems(limit = 100): Promise<JournalItem[]> {
  const db = await getDatabase();

  // Commands are journaled once when queued (with their reason); the queue
  // rows themselves are not merged in, which used to list each command twice.
  const rows = await db.getAllAsync<{
    id: number;
    type: string;
    message: string;
    created_at: number;
  }>(
    `SELECT id, type, message, created_at
     FROM journal
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    limit,
  );

  return rows.map((row) => ({
    id: `j-${row.id}`,
    type: row.type,
    message: row.message,
    createdAt: row.created_at,
  }));
}
