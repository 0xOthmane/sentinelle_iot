import { getDatabase } from '@/db/database';
import type { Device } from '@/types';

export async function saveDeviceToCache(device: Device): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO devices_cache
     (id, group_name, status, last_seen, cached_at)
     VALUES (?, ?, ?, ?, ?)`,
    device.id,
    device.group,
    device.status,
    device.lastSeen ?? null,
    Math.floor(Date.now() / 1000),
  );
}

export async function loadCachedDeviceStatus(
  deviceId: string,
): Promise<'online' | 'offline' | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ status: 'online' | 'offline' }>(
    `SELECT status FROM devices_cache WHERE id = ?`,
    deviceId,
  );

  return row?.status ?? null;
}
