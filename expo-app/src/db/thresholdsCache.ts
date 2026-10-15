import { getDatabase } from '@/db/database';
import type { Thresholds } from '@/types';

type ThresholdsRow = {
  t_min: number;
  t_max: number;
  h_min: number | null;
  h_max: number | null;
  hold_minutes: number;
  dirty: number;
};

export async function saveThresholdsToCache(
  device: string,
  value: Thresholds,
  dirty: boolean,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO thresholds_cache
     (device, t_min, t_max, h_min, h_max, hold_minutes, dirty, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    device,
    value.tMin,
    value.tMax,
    value.hMin,
    value.hMax,
    value.holdMinutes,
    dirty ? 1 : 0,
    Math.floor(Date.now() / 1000),
  );
}

export async function loadCachedThresholds(
  device: string,
): Promise<{ value: Thresholds; dirty: boolean } | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<ThresholdsRow>(
    `SELECT t_min, t_max, h_min, h_max, hold_minutes, dirty
     FROM thresholds_cache WHERE device = ?`,
    device,
  );

  if (!row) return null;

  return {
    value: {
      tMin: row.t_min,
      tMax: row.t_max,
      hMin: row.h_min,
      hMax: row.h_max,
      holdMinutes: row.hold_minutes,
    },
    dirty: row.dirty === 1,
  };
}

export async function loadDirtyThresholds(
  device: string,
): Promise<Thresholds | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    t_min: number;
    t_max: number;
    h_min: number | null;
    h_max: number | null;
    hold_minutes: number;
  }>(
    `SELECT t_min, t_max, h_min, h_max, hold_minutes
     FROM thresholds_cache
     WHERE device = ? AND dirty = 1`,
    device,
  );

  if (!row) return null;

  return {
    tMin: row.t_min,
    tMax: row.t_max,
    hMin: row.h_min,
    hMax: row.h_max,
    holdMinutes: row.hold_minutes,
  };
}
