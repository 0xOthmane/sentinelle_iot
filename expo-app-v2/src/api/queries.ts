import { queryOptions } from '@tanstack/react-query';

import { API_URL } from '@/constants/config';
import type { HistoryRange } from '@/types';
import { queryKeys } from './query-keys';
import {
  fetchActiveAlerts,
  fetchDevices,
  fetchHistory,
  fetchLiveMeasurements,
  fetchThresholds,
} from './client';

export const devicesQuery = () =>
  queryOptions({
    queryKey: queryKeys.devices(),
    queryFn: ({ signal }) => fetchDevices(API_URL, { signal }),
    staleTime: 60_000,
  });

export const liveMeasurementsQuery = (
  deviceId: string,
  windowSeconds: number = 600,
) =>
  queryOptions({
    queryKey: queryKeys.liveMeasurements(deviceId, windowSeconds),
    queryFn: ({ signal }) =>
      fetchLiveMeasurements(API_URL, deviceId, windowSeconds, { signal }),
    staleTime: 0,
  });

export const historyQuery = (deviceId: string, range: HistoryRange) =>
  queryOptions({
    queryKey: queryKeys.history(deviceId, range),
    queryFn: ({ signal }) => fetchHistory(API_URL, deviceId, range, { signal }),
    staleTime: 5 * 60_000,
  });

export const thresholdsQuery = (deviceId: string) =>
  queryOptions({
    queryKey: queryKeys.thresholds(deviceId),
    queryFn: ({ signal }) => fetchThresholds(API_URL, deviceId, { signal }),
    staleTime: 5 * 60_000,
  });

export const activeAlertsQuery = (deviceId: string) =>
  queryOptions({
    queryKey: queryKeys.activeAlerts(deviceId),
    queryFn: ({ signal }) => fetchActiveAlerts(API_URL, deviceId, { signal }),
    staleTime: 15_000,
  });