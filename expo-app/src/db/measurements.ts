import { getDatabase } from '@/db/database';
import type { HistoryRange, Measurement } from '@/types';
import { rangeSeconds } from '@/utils/format';

export type CachedMeasurement = Measurement & { device: string };

export async function saveMeasurementsToCache(
  device: string,
  data: Measurement[],
): Promise<void> {
  if (!data.length) return;

  const db = await getDatabase();

  for (const item of data) {
    await db.runAsync(
      `INSERT OR REPLACE INTO measurements_cache
       (device, ts, t, h) VALUES (?, ?, ?, ?)`,
      device,
      item.ts,
      item.t,
      item.h,
    );
  }

  const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
  await db.runAsync(
    `DELETE FROM measurements_cache
     WHERE device = ? AND ts < ?`,
    device,
    sevenDaysAgo,
  );
}

export async function loadCachedLive(
  device: string,
  windowSeconds = 600,
): Promise<CachedMeasurement[]> {
  const db = await getDatabase();
  const from = Math.floor(Date.now() / 1000) - windowSeconds;

  return db.getAllAsync<CachedMeasurement>(
    `SELECT device, ts, t, h
     FROM measurements_cache
     WHERE device = ? AND ts >= ?
     ORDER BY ts ASC`,
    device,
    from,
  );
}

export async function loadCachedRange(
  device: string,
  range: HistoryRange,
): Promise<CachedMeasurement[]> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  return db.getAllAsync<CachedMeasurement>(
    `SELECT device, ts, t, h
     FROM measurements_cache
     WHERE device = ? AND ts >= ? AND ts <= ?
     ORDER BY ts ASC`,
    device,
    now - rangeSeconds(range),
    now,
  );
}
