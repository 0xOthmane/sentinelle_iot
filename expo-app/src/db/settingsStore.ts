import { getDatabase } from '@/db/database';

const NOTIFICATIONS_KEY = 'notifications';

export async function loadNotificationsEnabled(): Promise<boolean> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = ?`,
    NOTIFICATIONS_KEY,
  );

  return row?.value === '1';
}

export async function saveNotificationsEnabled(
  enabled: boolean,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO app_settings (key, value)
     VALUES (?, ?)`,
    NOTIFICATIONS_KEY,
    enabled ? '1' : '0',
  );
}
