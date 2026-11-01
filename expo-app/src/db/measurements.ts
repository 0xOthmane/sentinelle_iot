import { getDatabase, runInTransaction } from '@/db/database';
import type { HistoryRange, Measurement } from '@/types';
import { rangeSeconds } from '@/utils/format';

export type CachedMeasurement = Measurement & { device: string };

const RETENTION_SECONDS = 7 * 86400;
const PRUNE_INTERVAL_SECONDS = 10 * 60;
let lastPruneAt = 0;

export async function saveMeasurementsToCache(
  device: string,
  data: Measurement[],
): Promise<void> {
  if (!data.length) return;

  const now = Math.floor(Date.now() / 1000);
  // Pruning on every live frame was a full DELETE per message.
  const prune = now - lastPruneAt >= PRUNE_INTERVAL_SECONDS;

  await runInTransaction(async (db) => {
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

    if (prune) {
      await db.runAsync(
        `DELETE FROM measurements_cache
         WHERE device = ? AND ts < ?`,
        device,
        now - RETENTION_SECONDS,
      );
    }
  });

  if (prune) lastPruneAt = now;
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
