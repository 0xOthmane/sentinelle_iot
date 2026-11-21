import type { ChartPoint } from '@/components/soft-chart';

/**
 * Maps measurement rows (for example `{ t, h }`) to the point list that
 * `SoftChart` expects. The x axis is the row index until the payload carries
 * timestamps.
 */
export function toChartPoints<T extends Record<string, number>>(
  rows: readonly T[],
  key: keyof T,
): ChartPoint[] {
  return rows.map((row, index) => ({ x: index, y: row[key] }));
}
