import { useQuery } from '@tanstack/react-query';

import { DEVICE_ID } from '@/constants/config';
import type { HistoryRange } from '@/types';
import { devicesQuery, historyQuery, liveMeasurementsQuery, thresholdsQuery, activeAlertsQuery } from './queries';

export function useDevices(options?: { enabled?: boolean }) {
  return useQuery({ ...devicesQuery(), enabled: options?.enabled ?? true });
}

export function useLiveMeasurements(options?: {
  deviceId?: string;
  windowSeconds?: number;
  refetchInterval?: number | false;
  enabled?: boolean;
}) {
  const deviceId = options?.deviceId ?? DEVICE_ID;
  const windowSeconds = options?.windowSeconds ?? 600;
  const query = liveMeasurementsQuery(deviceId, windowSeconds);
  return useQuery({
    ...query,
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? 15_000,
  });
}

export function useHistory(options: {
  deviceId?: string;
  range: HistoryRange;
  enabled?: boolean;
}) {
  const deviceId = options.deviceId ?? DEVICE_ID;
  const query = historyQuery(deviceId, options.range);
  return useQuery({ ...query, enabled: options.enabled ?? true });
}

export function useThresholds(deviceId: string = DEVICE_ID, options?: { enabled?: boolean }) {
  const query = thresholdsQuery(deviceId);
  return useQuery({ ...query, enabled: options?.enabled ?? true });
}

export function useActiveAlerts(deviceId: string = DEVICE_ID, options?: { enabled?: boolean }) {
  const query = activeAlertsQuery(deviceId);
  return useQuery({ ...query, enabled: options?.enabled ?? true });
}

export * from './mutations';