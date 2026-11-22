import type { HistoryStats, Measurement } from '@/types';

export function computeHistoryStats(
  data: readonly Measurement[],
): HistoryStats | null {
  if (data.length === 0) return null;

  const temperatures = data.map((measurement) => measurement.t);
  const humidities = data.map((measurement) => measurement.h);
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    tMin: Math.min(...temperatures),
    tAvg: average(temperatures),
    tMax: Math.max(...temperatures),
    hMin: Math.min(...humidities),
    hAvg: average(humidities),
    hMax: Math.max(...humidities),
  };
}
