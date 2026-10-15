import type {
  Device,
  HistoryRange,
  Measurement,
  Thresholds,
} from '@/types';
import { rangeBounds, rangeStep } from '@/utils/format';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function fetchDevices(apiUrl: string): Promise<Device[]> {
  return getJson<Device[]>(`${apiUrl}/devices`);
}

export async function fetchLiveMeasurements(
  apiUrl: string,
  deviceId: string,
  windowSeconds = 600,
): Promise<Measurement[]> {
  const now = Math.floor(Date.now() / 1000);
  return getJson<Measurement[]>(
    `${apiUrl}/devices/${deviceId}/measurements?from=${now - windowSeconds}&to=${now}`,
  );
}

export async function fetchHistory(
  apiUrl: string,
  deviceId: string,
  range: HistoryRange,
): Promise<Measurement[]> {
  const { from, to } = rangeBounds(range);
  const step = rangeStep(range);
  return getJson<Measurement[]>(
    `${apiUrl}/devices/${deviceId}/measurements?from=${from}&to=${to}&step=${step}`,
  );
}

export async function fetchThresholds(
  apiUrl: string,
  deviceId: string,
): Promise<Thresholds> {
  return getJson<Thresholds>(`${apiUrl}/devices/${deviceId}/thresholds`);
}

export async function putThresholds(
  apiUrl: string,
  deviceId: string,
  value: Thresholds,
): Promise<Thresholds> {
  const response = await fetch(
    `${apiUrl}/devices/${deviceId}/thresholds`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Thresholds;
}

export async function postCommand(
  apiUrl: string,
  deviceId: string,
  command: { id: string; led: boolean },
): Promise<{ status?: string } | null> {
  const response = await fetch(
    `${apiUrl}/devices/${deviceId}/commands`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: command.id, led: command.led }),
    },
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json().catch(() => null)) as {
    status?: string;
  } | null;
}
