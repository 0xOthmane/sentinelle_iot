import * as Crypto from 'expo-crypto';
import { getNotifications } from '@/utils/notifications';
import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, AppState } from 'react-native';

import {
  fetchActiveAlerts,
  fetchDevices,
  fetchHistory,
  fetchLiveMeasurements,
  fetchThresholds,
  postCommand,
  putThresholds,
} from '@/api/client';
import { createSentinelleSocket, type SnapshotAlert } from '@/api/websocket';
import {
  addCommand,
  getAllCommands,
  getReplayableCommands,
  incrementCommandAttempts,
  updateCommandStatus,
  type QueuedCommand,
} from '@/db/commands';
import { initDatabase } from '@/db/database';
import { loadCachedDeviceStatus, saveDeviceToCache } from '@/db/devices';
import {
  addJournalEntry,
  listJournalItems,
} from '@/db/journal';
import {
  loadCachedLive,
  loadCachedRange,
  saveMeasurementsToCache,
} from '@/db/measurements';
import {
  loadNotificationsEnabled,
  saveNotificationsEnabled,
} from '@/db/settingsStore';
import {
  loadCachedThresholds,
  loadDirtyThresholds,
  saveThresholdsToCache,
} from '@/db/thresholdsCache';
import {
  ALERT_AUTOMATION_RECENCY_SECONDS,
  API_URL,
  APP_NAME,
  DEFAULT_THRESHOLDS,
  DEVICE_ID,
  GROUP_NAME,
  WS_URL,
  defaultThresholdForm,
} from '@/constants/config';
import type {
  AlertEvent,
  Device,
  HistoryRange,
  HistoryStats,
  JournalItem,
  Measurement,
  ThresholdForm,
  Thresholds,
} from '@/types';
import {
  computeHistoryStats,
  describeAlert,
  formatAlertKind,
} from '@/utils/format';
import { log } from '@/utils/logger';
import { parseThresholdForm, thresholdsToForm } from '@/utils/thresholds';
import { useAuth } from '@/auth/AuthProvider';
import { getToken } from '@/auth/tokenStore';

export { APP_NAME };

type SentinelleContextValue = {
  temperature: number | null;
  humidity: number | null;
  liveMeasurements: Measurement[];
  historyMeasurements: Measurement[];
  historyStats: HistoryStats | null;
  deviceStatus: 'online' | 'offline';
  backendOnline: boolean;
  networkConnected: boolean;
  ledOn: boolean;
  ledPending: boolean;
  liveLoading: boolean;
  historyLoading: boolean;
  thresholdLoading: boolean;
  historyRange: HistoryRange;
  setHistoryRange: (range: HistoryRange) => void;
  thresholds: Thresholds;
  thresholdForm: ThresholdForm;
  setThresholdForm: React.Dispatch<React.SetStateAction<ThresholdForm>>;
  thresholdDirty: boolean;
  activeAlert: AlertEvent | null;
  notificationsEnabled: boolean;
  journalItems: JournalItem[];
  lastMeasurement: Measurement | null;
  toggleLed: () => Promise<void>;
  saveThresholdSettings: () => Promise<void>;
  toggleNotifications: (enabled: boolean) => Promise<void>;
  refreshJournal: () => Promise<void>;
};

const SentinelleContext = createContext<SentinelleContextValue | null>(null);

export function useSentinelle(): SentinelleContextValue {
  const value = useContext(SentinelleContext);
  if (!value) throw new Error('useSentinelle must be used inside provider');
  return value;
}

export function SentinelleProvider({ children }: { children: ReactNode }) {
  const { token: authToken } = useAuth();
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [liveMeasurements, setLiveMeasurements] = useState<Measurement[]>([]);
  const [historyMeasurements, setHistoryMeasurements] = useState<Measurement[]>([]);

  const [deviceStatus, setDeviceStatus] = useState<'online' | 'offline'>('offline');
  const [backendOnline, setBackendOnline] = useState(false);
  const [networkConnected, setNetworkConnected] = useState(true);

  const [ledOn, setLedOn] = useState(false);
  const [ledPending, setLedPending] = useState(false);

  const [liveLoading, setLiveLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [thresholdLoading, setThresholdLoading] = useState(false);

  const [historyRange, setHistoryRange] = useState<HistoryRange>('1h');
  const [thresholds, setThresholds] = useState<Thresholds>({
    ...DEFAULT_THRESHOLDS,
  });
  const [thresholdForm, setThresholdForm] = useState<ThresholdForm>(
    defaultThresholdForm,
  );
  const [thresholdDirty, setThresholdDirty] = useState(false);

  const [activeAlert, setActiveAlert] = useState<AlertEvent | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [journalItems, setJournalItems] = useState<JournalItem[]>([]);

  const disconnectRef = useRef<(() => void) | null>(null);
  const isFlushingRef = useRef(false);
  const notificationsRef = useRef(false);
  const networkRef = useRef(true);
  const backendRef = useRef(false);
  const historyRangeRef = useRef<HistoryRange>('1h');
  const activeAlertRef = useRef<AlertEvent | null>(null);
  // Mirrors ledOn for WS/journal callbacks (which close over stale state).
  const ledOnRef = useRef(false);
  // True when the last LED change came from alert automation (not the user).
  // Auto-OFF on clear only runs while this is set, so a manual ON is never
  // overridden.
  const autoLedRef = useRef(false);
  // Guards against overlapping runs: NetInfo fires immediately on subscribe
  // and WS onOpen also triggers a sync, so without these the same journal
  // writes run 2-3x concurrently and crash expo-sqlite on Android.
  const refreshInFlightRef = useRef(false);
  const syncingAlertsRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    activeAlertRef.current = activeAlert;
  }, [activeAlert]);

  useEffect(() => {
    ledOnRef.current = ledOn;
  }, [ledOn]);

  useEffect(() => {
    notificationsRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  useEffect(() => {
    historyRangeRef.current = historyRange;
  }, [historyRange]);

  const refreshJournal = useCallback(async () => {
    try {
      setJournalItems(await listJournalItems());
    } catch (error) {
      log('cache', 'journal', error);
    }
  }, []);

  const notifyLocal = useCallback(async (title: string, body: string) => {
    if (!notificationsRef.current) return;
    const Notifications = getNotifications();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  }, []);

  // ---------- commands ----------

  const sendCommand = useCallback(
    async (command: QueuedCommand): Promise<boolean> => {
      try {
        await incrementCommandAttempts(command.id);
        const body = await postCommand(API_URL, command.device, {
          id: command.id,
          led: command.led,
        });

        if (body?.status === 'acked') {
          await updateCommandStatus(command.id, 'acked');
          setLedPending(false);
        } else {
          await updateCommandStatus(command.id, 'sent');
          setLedPending(true);
        }
        await refreshJournal();
        return true;
      } catch {
        await updateCommandStatus(command.id, 'pending');
        await refreshJournal();
        return false;
      }
    },
    [refreshJournal],
  );

  const flushCommandQueue = useCallback(async () => {
    if (isFlushingRef.current || !networkRef.current) return;
    isFlushingRef.current = true;
    try {
      const replayable = await getReplayableCommands();
      for (const command of replayable) {
        const ok = await sendCommand(command);
        if (!ok) break;
      }
    } catch (error) {
      log('cache', 'commands', error);
    } finally {
      isFlushingRef.current = false;
    }
  }, [sendCommand]);

  // Shared enqueue flow for manual toggles and alert automation: persist to
  // the offline queue, journal the intent, and send immediately when online
  // (flushCommandQueue replays the rest on reconnect, oldest first).
  const enqueueLedCommand = useCallback(
    async (
      target: boolean,
      opts: { automatic: boolean; reason: string },
    ): Promise<void> => {
      if (ledOnRef.current === target) {
        log('ws', `led already ${target ? 'ON' : 'OFF'} (${opts.reason})`);
        return;
      }

      const command: QueuedCommand = {
        id: `c-${Crypto.randomUUID()}`,
        device: DEVICE_ID,
        led: target,
        status: 'pending',
        attempts: 0,
        createdAt: Math.floor(Date.now() / 1000),
      };

      ledOnRef.current = target;
      setLedOn(target);
      setLedPending(true);
      autoLedRef.current = opts.automatic && target;

      try {
        await addCommand(command);
        await addJournalEntry(
          'command',
          DEVICE_ID,
          `Veilleuse ${target ? 'ON' : 'OFF'} — ${opts.automatic ? `auto (${opts.reason})` : 'pending'}`,
        );
        await refreshJournal();
      } catch (error) {
        log('cache', 'command-queue', error);
      }

      if (networkRef.current) {
        await sendCommand(command);
      }
    },
    [refreshJournal, sendCommand],
  );

  // Turn the night light back off only if automation turned it on: a manual
  // ON by the user must never be overridden by a clearing alert.
  const automationLedOff = useCallback(
    async (reason: string): Promise<void> => {
      if (!autoLedRef.current) return;
      autoLedRef.current = false;
      await enqueueLedCommand(false, { automatic: true, reason });
    },
    [enqueueLedCommand],
  );

  // Reconcile server-known active alerts with local state. Used by both the
  // WS snapshot (push) and GET /alerts/active (poll) so a missed "alert"
  // frame is recovered on every reconnect/refresh instead of only on the
  // next firing. Journals/notifies (and the night-light automation) only on
  // transitions to avoid spam.
  const applySyncedAlerts = useCallback(
    async (alerts: (AlertEvent | SnapshotAlert)[], source: string) => {
      const latest = alerts.length > 0 ? alerts[alerts.length - 1] : null;
      const current = activeAlertRef.current;

      try {
        if (!latest) {
          if (current) {
            activeAlertRef.current = null;
            setActiveAlert(null);
            await addJournalEntry(
              'alert_cleared',
              DEVICE_ID,
              `Retour à la normale (resync ${source})`,
            );
            await refreshJournal();
            await automationLedOff(`retour normale (resync ${source})`);
          }
          return;
        }

        const next: AlertEvent = {
          kind: latest.kind,
          value: latest.value,
          threshold: latest.threshold,
          ts: latest.ts,
        };

        if (!current || current.kind !== next.kind || current.ts !== next.ts) {
          activeAlertRef.current = next;
          setActiveAlert(next);
          const text = describeAlert(next);
          await addJournalEntry(
            'alert',
            DEVICE_ID,
            `${text} (resync ${source})`,
          );
          await refreshJournal();
          await notifyLocal('Alerte dans la chambre', text);
          // Only automate recent alerts: a stale alert recovered on reconnect
          // still updates the UI, but must not flip the night light for an
          // hours-old event. Missing ts counts as recent (live-like frame).
          const nowSec = Math.floor(Date.now() / 1000);
          const ageSec = nowSec - (next.ts ?? nowSec);
          if (ageSec <= ALERT_AUTOMATION_RECENCY_SECONDS) {
            await enqueueLedCommand(true, {
              automatic: true,
              reason: `alerte ${next.kind} (resync ${source})`,
            });
          } else {
            log('ws', `stale alert ${next.kind} resync: UI only, no command`);
          }
        }
      } catch (error) {
        log('cache', `alert-sync-${source}`, error);
      }
    },
    [automationLedOff, enqueueLedCommand, notifyLocal, refreshJournal],
  );

  const loadActiveAlerts = useCallback(async () => {
    // WS onOpen, NetInfo and refreshAll can overlap: never run two syncs
    // concurrently, and never let a DB failure escape as uncaught.
    if (syncingAlertsRef.current) return;
    syncingAlertsRef.current = true;
    try {
      const alerts = await fetchActiveAlerts(API_URL, DEVICE_ID);
      await applySyncedAlerts(alerts, 'http');
    } catch (error) {
      log('net', 'active-alerts', error);
    } finally {
      syncingAlertsRef.current = false;
    }
  }, [applySyncedAlerts]);

  // ---------- loaders (network + cache fallback) ----------

  const loadDevices = useCallback(async () => {
    try {
      const devices: Device[] = await fetchDevices(API_URL);
      const device = devices.find((item) => item.id === DEVICE_ID);
      if (device) {
        setDeviceStatus(device.status);
        await saveDeviceToCache(device);
      }
      backendRef.current = true;
      setBackendOnline(true);
    } catch {
      backendRef.current = false;
      setBackendOnline(false);
    }
  }, []);

  const loadLiveMeasurements = useCallback(async () => {
    try {
      const data = await fetchLiveMeasurements(API_URL, DEVICE_ID);
      setLiveMeasurements(data);
      await saveMeasurementsToCache(DEVICE_ID, data);
      if (data.length) {
        const last = data[data.length - 1];
        setTemperature(last.t);
        setHumidity(last.h);
      }
      backendRef.current = true;
      setBackendOnline(true);
    } catch {
      backendRef.current = false;
      setBackendOnline(false);
      try {
        const rows = await loadCachedLive(DEVICE_ID);
        if (rows.length) {
          setLiveMeasurements(rows);
          const last = rows[rows.length - 1];
          setTemperature(last.t);
          setHumidity(last.h);
        }
      } catch (error) {
        log('cache', 'measurements', error);
      }
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (range: HistoryRange) => {
    try {
      setHistoryLoading(true);
      const data = await fetchHistory(API_URL, DEVICE_ID, range);
      setHistoryMeasurements(data);
    } catch {
      try {
        const rows = await loadCachedRange(DEVICE_ID, range);
        if (rows.length) setHistoryMeasurements(rows);
      } catch (error) {
        log('cache', 'history', error);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const applyThresholds = useCallback((value: Thresholds, dirty: boolean) => {
    setThresholds(value);
    setThresholdForm(thresholdsToForm(value));
    setThresholdDirty(dirty);
  }, []);

  const loadThresholds = useCallback(async () => {
    try {
      setThresholdLoading(true);
      const data = await fetchThresholds(API_URL, DEVICE_ID);
      applyThresholds(data, false);
      await saveThresholdsToCache(DEVICE_ID, data, false);
    } catch {
      const cached = await loadCachedThresholds(DEVICE_ID);
      if (cached) applyThresholds(cached.value, cached.dirty);
    } finally {
      setThresholdLoading(false);
    }
  }, [applyThresholds]);

  const refreshAll = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    // No session yet (or after logout): keep cached data, skip network.
    const session = await getToken();
    if (!session) return;
    refreshInFlightRef.current = true;
    try {
      await loadDevices();
      await loadLiveMeasurements();
      await loadHistory(historyRangeRef.current);
      await loadThresholds();
      await loadActiveAlerts();
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [
    loadDevices,
    loadLiveMeasurements,
    loadHistory,
    loadThresholds,
    loadActiveAlerts,
  ]);

  // ---------- commands (threshold sync + manual toggle) ----------

  const syncDirtyThresholds = useCallback(async () => {
    try {
      const dirty = await loadDirtyThresholds(DEVICE_ID);
      if (!dirty) return;
      const saved = await putThresholds(API_URL, DEVICE_ID, dirty);
      applyThresholds(saved, false);
      await saveThresholdsToCache(DEVICE_ID, saved, false);
      await addJournalEntry(
        'thresholds',
        DEVICE_ID,
        'Seuils hors ligne rejoués et confirmés',
      );
      await refreshJournal();
    } catch (error) {
      log('thresholds', 'replay', error);
    }
  }, [applyThresholds, refreshJournal]);

  // Shared enqueue flow for manual toggles and alert automation: persist to
  // the offline queue, journal the intent, and send immediately when online
  // (flushCommandQueue replays the rest on reconnect, oldest first).
  const toggleLed = useCallback(async () => {
    autoLedRef.current = false;
    await enqueueLedCommand(!ledOnRef.current, {
      automatic: false,
      reason: 'manual',
    });
  }, [enqueueLedCommand]);

  const saveThresholdSettings = useCallback(async () => {
    const parsed = parseThresholdForm(thresholdForm);
    if ('error' in parsed) {
      Alert.alert(parsed.error.title, parsed.error.message);
      return;
    }
    const value = parsed.value;
    setThresholds(value);

    if (!networkRef.current || !backendRef.current) {
      try {
        await saveThresholdsToCache(DEVICE_ID, value, true);
        setThresholdDirty(true);
        await addJournalEntry(
          'thresholds',
          DEVICE_ID,
          'Seuils modifiés hors ligne — synchronisation en attente',
        );
        await refreshJournal();
      } catch (error) {
        log('cache', 'thresholds-offline', error);
      }
      Alert.alert(
        'Enregistré hors ligne',
        'Les seuils seront envoyés automatiquement au retour du réseau.',
      );
      return;
    }

    try {
      setThresholdLoading(true);
      const saved = await putThresholds(API_URL, DEVICE_ID, value);
      applyThresholds(saved, false);
      await saveThresholdsToCache(DEVICE_ID, saved, false);
      await addJournalEntry(
        'thresholds',
        DEVICE_ID,
        `Seuils synchronisés — délai ${saved.holdMinutes} min`,
      );
      await refreshJournal();
      Alert.alert('Enregistré', 'Les seuils ont été mis à jour.');
    } catch {
      try {
        await saveThresholdsToCache(DEVICE_ID, value, true);
      } catch (error) {
        log('cache', 'thresholds-fallback', error);
      }
      setThresholdDirty(true);
      Alert.alert(
        'Connexion perdue',
        'Les seuils sont conservés localement.',
      );
    } finally {
      setThresholdLoading(false);
    }
  }, [thresholdForm, applyThresholds, refreshJournal]);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      await saveNotificationsEnabled(false);
      return;
    }

    const Notifications = getNotifications();
    if (!Notifications) {
      setNotificationsEnabled(false);
      await saveNotificationsEnabled(false);
      Alert.alert(
        'Notifications indisponibles',
        'Mettez à jour Expo Go ou installez une nouvelle version de développement compatible. Les alertes restent visibles dans l’app et dans le Journal.',
      );
      return;
    }

    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      setNotificationsEnabled(false);
      await saveNotificationsEnabled(false);
      Alert.alert(
        'Notifications refusées',
        'Les alertes resteront visibles dans l’app et dans le Journal.',
      );
      return;
    }

    setNotificationsEnabled(true);
    await saveNotificationsEnabled(true);
  }, []);

  // ---------- websocket ----------

  const connectWebSocket = useCallback(() => {
    if (!networkRef.current) return;
    disconnectRef.current?.();

    // Ticket issuance needs a session; skip silently when logged out
    // (the auth guard redirects to /login, and login re-triggers sync).
    void getToken().then((session) => {
      if (!session || !networkRef.current) return;
      disconnectRef.current?.();
      disconnectRef.current = createSentinelleSocket(
        WS_URL,
        API_URL,
        DEVICE_ID,
        {
      onOpen: async () => {
        backendRef.current = true;
        setBackendOnline(true);
        await syncDirtyThresholds();
        await flushCommandQueue();
        // Snapshot may arrive a frame later; HTTP resync covers the case
        // where it was missed or the socket was opened before thresholds.
        await loadActiveAlerts();
      },
      onError: () => {
        backendRef.current = false;
        setBackendOnline(false);
      },
      onClose: () => {
        if (networkRef.current) {
          backendRef.current = false;
          setBackendOnline(false);
        }
      },
      onMeasurement: async (m) => {
        setTemperature(m.t);
        setHumidity(m.h);
        setLiveMeasurements((previous) => {
          const minTs = Math.floor(Date.now() / 1000) - 600;
          return [...previous, m]
            .filter((item) => item.ts >= minTs)
            .sort((a, b) => a.ts - b.ts);
        });
        await saveMeasurementsToCache(DEVICE_ID, [m]);
      },
      onDeviceStatus: async (status) => {
        setDeviceStatus(status);
        await saveDeviceToCache({
          id: DEVICE_ID,
          group: GROUP_NAME,
          status,
        });
        await addJournalEntry(
          'device_status',
          DEVICE_ID,
          `Capteur ${status === 'online' ? 'en ligne' : 'hors ligne'}`,
        );
        await refreshJournal();
      },
      onAlert: async (alertData) => {
        activeAlertRef.current = alertData;
        setActiveAlert(alertData);
        const text = describeAlert(alertData);
        await addJournalEntry('alert', DEVICE_ID, text);
        await refreshJournal();
        await notifyLocal('Alerte dans la chambre', text);
        await enqueueLedCommand(true, {
          automatic: true,
          reason: `alerte ${alertData.kind}`,
        });
      },
      onAlertCleared: async (kind) => {
        activeAlertRef.current = null;
        setActiveAlert(null);
        await addJournalEntry(
          'alert_cleared',
          DEVICE_ID,
          `Retour à la normale (${formatAlertKind(kind)})`,
        );
        await refreshJournal();
        await automationLedOff('retour normale');
      },
      onSnapshot: async (alerts) => {
        await applySyncedAlerts(alerts, 'snapshot');
      },
      onCommandAcked: async (id) => {
        await updateCommandStatus(id, 'acked');
        setLedPending(false);
        await addJournalEntry(
          'command',
          DEVICE_ID,
          `Commande ${id} confirmée — acked`,
        );
        await refreshJournal();
      },
        },
      );
    });
  }, [
    applySyncedAlerts,
    automationLedOff,
    enqueueLedCommand,
    flushCommandQueue,
    loadActiveAlerts,
    notifyLocal,
    refreshJournal,
    syncDirtyThresholds,
  ]);

  // ---------- lifecycle ----------

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      try {
        await initDatabase();
      } catch (error) {
        // getDatabase() shares one open+migrate promise, so a failure here
        // is already logged by callers; continue so network refresh can
        // retry instead of leaving the app stuck on a blank screen.
        log('cache', 'init', error);
      }

      const [cachedRows, cachedDevice, cachedThresholds, commands, notif] =
        await Promise.all([
          loadCachedLive(DEVICE_ID).catch(() => []),
          loadCachedDeviceStatus(DEVICE_ID).catch(() => null),
          loadCachedThresholds(DEVICE_ID).catch(() => null),
          getAllCommands().catch(() => []),
          loadNotificationsEnabled().catch(() => false),
        ]);

      if (cachedDevice) setDeviceStatus(cachedDevice);
      if (cachedRows.length) {
        setLiveMeasurements(cachedRows);
        const last = cachedRows[cachedRows.length - 1];
        setTemperature(last.t);
        setHumidity(last.h);
      }
      try {
        const cachedHistory = await loadCachedRange(DEVICE_ID, '1h');
        if (cachedHistory.length) setHistoryMeasurements(cachedHistory);
      } catch (error) {
        log('cache', 'history', error);
      }
      if (cachedThresholds) {
        applyThresholds(cachedThresholds.value, cachedThresholds.dirty);
      }
      if (commands.length) {
        const last = commands[0];
        setLedOn(last.led);
        setLedPending(
          last.status === 'pending' || last.status === 'sent',
        );
      }
      setNotificationsEnabled(notif && getNotifications() !== null);
      await refreshJournal();

      setLiveLoading(false);

      await refreshAll();
      if (mounted) connectWebSocket();
      readyRef.current = true;
    };

    start();

    const netSubscription = NetInfo.addEventListener((state) => {
      const connected =
        state.isConnected === true && state.isInternetReachable !== false;
      networkRef.current = connected;
      setNetworkConnected(connected);

      if (!connected) {
        backendRef.current = false;
        setBackendOnline(false);
        disconnectRef.current?.();
        void (async () => {
          const rows = await loadCachedRange(
            DEVICE_ID,
            historyRangeRef.current,
          ).catch(() => []);
          if (rows.length) setHistoryMeasurements(rows);
        })();
        return;
      }

      void refreshAll().catch((error) => log('net', 'refresh', error));
      if (!readyRef.current) {
        // NetInfo fires immediately on subscribe while start() is still
        // running its own refreshAll: skip to avoid a duplicate stampede.
        return;
      }
      connectWebSocket();
      void flushCommandQueue();
      void syncDirtyThresholds();
    });

    const appSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (!readyRef.current) return;
        void refreshAll().catch((error) => log('net', 'refresh', error));
        connectWebSocket();
      } else {
        disconnectRef.current?.();
      }
    });

    return () => {
      mounted = false;
      netSubscription();
      appSubscription.remove();
      disconnectRef.current?.();
    };
  }, [
    applyThresholds,
    connectWebSocket,
    flushCommandQueue,
    refreshAll,
    refreshJournal,
    syncDirtyThresholds,
  ]);

  // Auth transitions: after login, sync + open the ticket-authed socket;
  // after logout/401-expiry, drop the socket (HTTP already fails fast).
  useEffect(() => {
    if (!readyRef.current) return;
    if (authToken) {
      void refreshAll().catch((error) => log('net', 'refresh', error));
      connectWebSocket();
    } else {
      disconnectRef.current?.();
      disconnectRef.current = null;
      backendRef.current = false;
      // Deferred so the logout transition doesn't trigger a cascading
      // render inside the effect body (react-hooks/set-state-in-effect).
      queueMicrotask(() => setBackendOnline(false));
    }
  }, [authToken, connectWebSocket, refreshAll]);

  const changeHistoryRange = useCallback(
    (range: HistoryRange) => {
      setHistoryRange(range);
      historyRangeRef.current = range;
      if (networkRef.current) {
        void loadHistory(range);
      } else {
        void (async () => {
          const rows = await loadCachedRange(DEVICE_ID, range).catch(
            () => [],
          );
          if (rows.length) setHistoryMeasurements(rows);
        })();
      }
    },
    [loadHistory],
  );

  const historyStats = useMemo(
    () => computeHistoryStats(historyMeasurements),
    [historyMeasurements],
  );

  const lastMeasurement =
    liveMeasurements.length > 0
      ? liveMeasurements[liveMeasurements.length - 1]
      : null;

  const value = useMemo<SentinelleContextValue>(
    () => ({
      temperature,
      humidity,
      liveMeasurements,
      historyMeasurements,
      historyStats,
      deviceStatus,
      backendOnline,
      networkConnected,
      ledOn,
      ledPending,
      liveLoading,
      historyLoading,
      thresholdLoading,
      historyRange,
      setHistoryRange: changeHistoryRange,
      thresholds,
      thresholdForm,
      setThresholdForm,
      thresholdDirty,
      activeAlert,
      notificationsEnabled,
      journalItems,
      lastMeasurement,
      toggleLed,
      saveThresholdSettings,
      toggleNotifications,
      refreshJournal,
    }),
    [
      temperature,
      humidity,
      liveMeasurements,
      historyMeasurements,
      historyStats,
      deviceStatus,
      backendOnline,
      networkConnected,
      ledOn,
      ledPending,
      liveLoading,
      historyLoading,
      thresholdLoading,
      historyRange,
      changeHistoryRange,
      thresholds,
      thresholdForm,
      thresholdDirty,
      activeAlert,
      notificationsEnabled,
      journalItems,
      lastMeasurement,
      toggleLed,
      saveThresholdSettings,
      toggleNotifications,
      refreshJournal,
    ],
  );

  return (
    <SentinelleContext.Provider value={value}>
      {children}
    </SentinelleContext.Provider>
  );
}
