import type { HistoryRange } from '@/types';

export function rangeSeconds(range: HistoryRange): number {
  if (range === '1h') return 3600;
  if (range === '24h') return 86400;
  return 7 * 86400;
}

export function rangeStep(range: HistoryRange): number {
  if (range === '1h') return 60;
  if (range === '24h') return 300;
  return 1800;
}

export function rangeBounds(
  range: HistoryRange,
  now: number = Math.floor(Date.now() / 1000),
): { from: number; to: number } {
  return { from: now - rangeSeconds(range), to: now };
}