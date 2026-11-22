import type { ChartPoint } from '@/components/soft-chart';
import type { HistoryRange } from '@/types';

/**
 * Maps measurement rows (for example `{ ts, t, h }`) to the point list that
 * `SoftChart` expects. Pass `xKey` when the x axis should carry real values
 * (the live chart uses Unix seconds); omit it for an index-based axis.
 */
export function toChartPoints<T extends Record<string, number>>(
  rows: readonly T[],
  key: keyof T,
  xKey?: keyof T,
): ChartPoint[] {
  return rows.map((row, index) => ({
    x: xKey === undefined ? index : row[xKey],
    y: row[key],
  }));
}

/** Local `HH:mm` label for a Unix-second timestamp. */
export function formatClockTime(tsSeconds: number): string {
  const date = new Date(tsSeconds * 1000);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Axis label matching the history range: time for short ranges, date for 7d. */
export function formatHistoryTime(range: HistoryRange, tsSeconds: number): string {
  const date = new Date(tsSeconds * 1000);

  if (range === '7d') {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  }

  return formatClockTime(tsSeconds);
}
