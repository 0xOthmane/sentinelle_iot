import { useCallback, useMemo, useRef } from 'react';
import {
  fetchActiveAlerts,
  fetchDevices,
  fetchHistory,
  fetchLiveMeasurements,
} from '@/api/client';
import { getToken } from '@/auth/tokenStore';
import { API_URL, DEVICE_ID } from '@/constants/config';
import { getAllCommands } from '@/db/commands';
import { initDatabase } from '@/db/database';
import { loadCachedDeviceStatus } from '@/db/devices';
import { loadCachedLive, loadCachedRange } from '@/db/measurements';
import { loadNotificationsEnabled } from '@/db/settingsStore';
import { loadCachedThresholds } from '@/db/thresholdsCache';
import type {
  SentinelleContextValue,
  SentinelleLiveValue,
} from '@/state/SentinelleContext';
import type { Measurement } from '@/types';
import { log } from '@/utils/logger';
import { useAlertSync } from './useAlertSync';
import { useCommandQueue } from './useCommandQueue';
import { useConnectionState } from './useConnectionState';
import { useConnectivity } from './useConnectivity';
import { useDeviceStatus } from './useDeviceStatus';
import { useJournal } from './useJournal';
import { useMeasurements } from './useMeasurements';
import { useNotifications } from './useNotifications';
import { useThresholds } from './useThresholds';

/** Composes the domain hooks into the values exposed by SentinelleProvider. */
export function useSentinelleController(
  authToken: string | null,
  authReady: boolean,
): {
  value: SentinelleContextValue;
  liveValue: SentinelleLiveValue;
} {
  const connection = useConnectionState();
  const { networkRef, backendRef, setBackend } = connection;

  const { journalItems, refreshJournal } = useJournal();
  const notifications = useNotifications();
  const device = useDeviceStatus({ setBackend, refreshJournal });
  const measurements = useMeasurements({ networkRef, setBackend });
  const thresholds = useThresholds({ networkRef, backendRef, refreshJournal });
  const commands = useCommandQueue({ networkRef, refreshJournal });
  const alerts = useAlertSync({
    refreshJournal,
    notifyLocal: notifications.notifyLocal,
    enqueueLedCommand: commands.enqueueLedCommand,
    automationLedOff: commands.automationLedOff,
  });

  const { hydrateDeviceStatus, loadDevices } = device;
  const { hydrateMeasurements, loadLiveMeasurements, loadHistory, historyRangeRef } =
    measurements;
  const { applyThresholds, loadThresholds } = thresholds;
  const { hydrateCommands } = commands;
  const { hydrateNotifications } = notifications;
  const { loadActiveAlerts } = alerts;

  const bootstrap = useCallback(async () => {
    try {
      await initDatabase();
    } catch (error) {
      // getDatabase() shares one open+migrate promise, so a failure here
      // is already logged by callers; continue so network refresh can
      // retry instead of leaving the app stuck on a blank screen.
      log('cache', 'init', error);
    }

    const [cachedRows, cachedDevice, cachedThresholds, queued, notif] =
      await Promise.all([
        loadCachedLive(DEVICE_ID).catch(() => []),
        loadCachedDeviceStatus(DEVICE_ID).catch(() => null),
        loadCachedThresholds(DEVICE_ID).catch(() => null),
        getAllCommands().catch(() => []),
        loadNotificationsEnabled().catch(() => false),
      ]);

    let cachedHistory: Measurement[] = [];
    try {
      cachedHistory = await loadCachedRange(DEVICE_ID, historyRangeRef.current);
    } catch (error) {
      log('cache', 'history', error);
    }

    hydrateDeviceStatus(cachedDevice);
    hydrateMeasurements(cachedRows, cachedHistory);
    if (cachedThresholds) {
      applyThresholds(cachedThresholds.value, cachedThresholds.dirty);
    }
    hydrateCommands(queued);
    hydrateNotifications(notif);
    await refreshJournal();
  }, [
    applyThresholds,
    historyRangeRef,
    hydrateCommands,
    hydrateDeviceStatus,
    hydrateMeasurements,
    hydrateNotifications,
    refreshJournal,
  ]);

  // NetInfo, AppState, WS onOpen and login can all request a refresh at
  // once; the flag is taken before any await so only one run proceeds.
  const refreshInFlightRef = useRef(false);

  const refreshAll = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      // No session yet (or after logout): keep cached data, skip network.
      const session = await getToken();
      if (!session) return;

      // Requests run in parallel, but results are applied one loader at a
      // time: overlapping expo-sqlite writes crash the native module on
      // Android. Alerts go last since they may enqueue LED commands.
      const range = historyRangeRef.current;
      const devicesRequest = fetchDevices(API_URL);
      const liveRequest = fetchLiveMeasurements(API_URL, DEVICE_ID);
      const historyRequest = fetchHistory(API_URL, DEVICE_ID, range);
      const alertsRequest = fetchActiveAlerts(API_URL, DEVICE_ID);
      // Rejections are handled by each loader once awaited; this only
      // prevents "unhandled rejection" warnings while earlier loaders run.
      for (const request of [
        devicesRequest,
        liveRequest,
        historyRequest,
        alertsRequest,
      ]) {
        request.catch(() => undefined);
      }

      await loadDevices(devicesRequest);
      await loadLiveMeasurements(liveRequest);
      await loadHistory(range, historyRequest);
      await loadThresholds();
      await loadActiveAlerts(alertsRequest);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [
    historyRangeRef,
    loadActiveAlerts,
    loadDevices,
    loadHistory,
    loadLiveMeasurements,
    loadThresholds,
  ]);

  const { forceReconnect } = useConnectivity({
    authToken,
    authReady,
    connection,
    bootstrap,
    refreshAll,
    pollLive: () => loadLiveMeasurements(),
    onReconnect: () => {
      void commands.flushCommandQueue();
      void thresholds.syncDirtyThresholds();
    },
    onOffline: () => {
      void measurements.loadCachedHistory(historyRangeRef.current);
    },
    socketHandlers: {
      onOpen: async () => {
        // Backfill the live window first: anything published while the
        // socket was down (screen-off, tunnel drop) is restored here; WS
        // frames dedupe against it via latestMeasurementTsRef.
        await loadLiveMeasurements();
        await thresholds.syncDirtyThresholds();
        await commands.flushCommandQueue();
        // Snapshot may arrive a frame later; HTTP resync covers the case
        // where it was missed or the socket was opened before thresholds.
        await loadActiveAlerts();
      },
      onMeasurement: measurements.handleMeasurement,
      onDeviceStatus: device.handleDeviceStatus,
      onAlert: alerts.handleAlert,
      onAlertCleared: alerts.handleAlertCleared,
      onSnapshot: (snapshot) => alerts.applySyncedAlerts(snapshot, 'snapshot'),
      onCommandAcked: commands.handleCommandAcked,
    },
  });

  const value = useMemo<SentinelleContextValue>(
    () => ({
      historyMeasurements: measurements.historyMeasurements,
      historyStats: measurements.historyStats,
      deviceStatus: device.deviceStatus,
      backendOnline: connection.backendOnline,
      networkConnected: connection.networkConnected,
      wsStatus: connection.wsStatus,
      wsStatusSince: connection.wsStatusSince,
      forceWsReconnect: forceReconnect,
      ledOn: commands.ledOn,
      ledPending: commands.ledPending,
      historyLoading: measurements.historyLoading,
      thresholdLoading: thresholds.thresholdLoading,
      historyRange: measurements.historyRange,
      setHistoryRange: measurements.changeHistoryRange,
      thresholds: thresholds.thresholds,
      thresholdForm: thresholds.thresholdForm,
      setThresholdForm: thresholds.setThresholdForm,
      thresholdDirty: thresholds.thresholdDirty,
      activeAlert: alerts.activeAlert,
      notificationsEnabled: notifications.notificationsEnabled,
      journalItems,
      toggleLed: commands.toggleLed,
      saveThresholdSettings: thresholds.saveThresholdSettings,
      toggleNotifications: notifications.toggleNotifications,
      refreshJournal,
    }),
    [
      measurements.historyMeasurements,
      measurements.historyStats,
      device.deviceStatus,
      connection.backendOnline,
      connection.networkConnected,
      connection.wsStatus,
      connection.wsStatusSince,
      forceReconnect,
      commands.ledOn,
      commands.ledPending,
      measurements.historyLoading,
      thresholds.thresholdLoading,
      measurements.historyRange,
      measurements.changeHistoryRange,
      thresholds.thresholds,
      thresholds.thresholdForm,
      thresholds.setThresholdForm,
      thresholds.thresholdDirty,
      alerts.activeAlert,
      notifications.notificationsEnabled,
      journalItems,
      commands.toggleLed,
      thresholds.saveThresholdSettings,
      notifications.toggleNotifications,
      refreshJournal,
    ],
  );

  const liveValue = useMemo<SentinelleLiveValue>(
    () => ({
      temperature: measurements.temperature,
      humidity: measurements.humidity,
      liveMeasurements: measurements.liveMeasurements,
      lastMeasurement: measurements.lastMeasurement,
      liveLoading: measurements.liveLoading,
    }),
    [
      measurements.temperature,
      measurements.humidity,
      measurements.liveMeasurements,
      measurements.lastMeasurement,
      measurements.liveLoading,
    ],
  );

  return { value, liveValue };
}
