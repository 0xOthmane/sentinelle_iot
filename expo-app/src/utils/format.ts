import type { AlertEvent, HistoryRange, HistoryStats, Measurement } from '@/types';

export function describeAlert(alert: AlertEvent): string {
  const kind = formatAlertKind(alert.kind);

  if (alert.value == null || alert.threshold == null) {
    return `${kind} hors seuil`;
  }

  return `${kind} : ${alert.value.toFixed(1)} (seuil ${alert.threshold})`;
}

export function formatAlertKind(kind: string): string {
  if (kind === 'tMax') return 'Température trop élevée';
  if (kind === 'tMin') return 'Température trop basse';
  if (kind === 'hMax') return 'Humidité trop élevée';
  if (kind === 'hMin') return 'Humidité trop basse';
  return kind;
}

export function journalIcon(type: string): string {
  if (type === 'alert') return '🚨';
  if (type === 'alert_cleared') return '✅';
  if (type === 'device_status') return '📡';
  if (type === 'thresholds') return '🎚️';
  if (type === 'command') return '💡';
  return '•';
}

export function formatDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

export function rangeBounds(range: HistoryRange, now = Math.floor(Date.now() / 1000)) {
  return { from: now - rangeSeconds(range), to: now };
}

export function computeHistoryStats(data: Measurement[]): HistoryStats | null {
  if (!data.length) return null;

  const temps = data.map((item) => item.t);
  const hums = data.map((item) => item.h);
  const avg = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    tMin: Math.min(...temps),
    tAvg: avg(temps),
    tMax: Math.max(...temps),
    hMin: Math.min(...hums),
    hAvg: avg(hums),
    hMax: Math.max(...hums),
  };
}

export function connectionLabel(
  networkConnected: boolean,
  backendOnline: boolean,
  deviceStatus: 'online' | 'offline',
): string {
  if (!networkConnected) return 'Mode hors ligne';
  if (!backendOnline) return 'Reconnexion';
  if (deviceStatus === 'offline') return 'Capteur hors ligne';
  return 'En direct';
}
