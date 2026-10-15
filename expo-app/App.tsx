import { StatusBar } from 'expo-status-bar';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';

import {
  initDatabase,
  getDatabase,
  addCommand,
  getAllCommands,
  updateCommandStatus,
  incrementCommandAttempts,
  addJournalEntry,
  type CachedMeasurement,
  type QueuedCommand,
} from './storage';

const API_URL = 'http://172.20.10.4:3000';
const WS_URL = 'ws://172.20.10.4:3000/ws';

const DEVICE_ID = 'esp05';
const GROUP_NAME = 'groupe5';
const APP_NAME = 'Petit Nid';

type Measurement = { ts: number; t: number; h: number };
type Device = {
  id: string;
  group: string;
  status: 'online' | 'offline';
  lastSeen?: number;
};
type Thresholds = {
  tMin: number;
  tMax: number;
  hMin: number | null;
  hMax: number | null;
  holdMinutes: number;
};
type HistoryRange = '1h' | '24h' | '7d';
type Tab = 'home' | 'history' | 'settings' | 'journal';
type AlertEvent = {
  kind: string;
  value?: number;
  threshold?: number;
  ts?: number;
};
type JournalItem = {
  id: string;
  type: string;
  message: string;
  createdAt: number;
};

const DEFAULT_THRESHOLDS: Thresholds = {
  tMin: 18,
  tMax: 26,
  hMin: 35,
  hMax: 70,
  holdMinutes: 1,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');

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
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [thresholdDirty, setThresholdDirty] = useState(false);

  const [thresholdForm, setThresholdForm] = useState({
    tMin: String(DEFAULT_THRESHOLDS.tMin),
    tMax: String(DEFAULT_THRESHOLDS.tMax),
    hMin: String(DEFAULT_THRESHOLDS.hMin ?? ''),
    hMax: String(DEFAULT_THRESHOLDS.hMax ?? ''),
    holdMinutes: String(DEFAULT_THRESHOLDS.holdMinutes),
  });

  const [activeAlert, setActiveAlert] = useState<AlertEvent | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [journalItems, setJournalItems] = useState<JournalItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const isFlushingRef = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const lastMeasurement =
    liveMeasurements.length > 0
      ? liveMeasurements[liveMeasurements.length - 1]
      : null;

  const roomState = useMemo(() => {
    if (activeAlert) {
      return {
        kind: 'alert',
        title: 'Alerte',
        text: describeAlert(activeAlert),
      };
    }

    if (temperature == null || humidity == null) {
      return {
        kind: 'neutral',
        title: 'En attente',
        text: 'Aucune mesure disponible',
      };
    }

    const tempOut =
      temperature < thresholds.tMin || temperature > thresholds.tMax;

    const humOut =
      (thresholds.hMin != null && humidity < thresholds.hMin) ||
      (thresholds.hMax != null && humidity > thresholds.hMax);

    if (tempOut || humOut) {
      return {
        kind: 'warning',
        title: 'À surveiller',
        text: `Hors seuil — alerte après ${thresholds.holdMinutes} min`,
      };
    }

    return {
      kind: 'good',
      title: 'Tout va bien',
      text: 'Conditions dans la plage définie',
    };
  }, [activeAlert, temperature, humidity, thresholds]);

  useEffect(() => {
    if (!activeAlert) {
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.84,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [activeAlert]);

  const ensureExtraTables = async () => {
    const db = await getDatabase();

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS thresholds_cache (
        device TEXT PRIMARY KEY NOT NULL,
        t_min REAL NOT NULL,
        t_max REAL NOT NULL,
        h_min REAL,
        h_max REAL,
        hold_minutes INTEGER NOT NULL,
        dirty INTEGER NOT NULL DEFAULT 0,
        cached_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  };

  const saveMeasurementsToCache = async (data: Measurement[]) => {
    if (!data.length) return;

    const db = await getDatabase();

    for (const item of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO measurements_cache
         (device, ts, t, h) VALUES (?, ?, ?, ?)`,
        DEVICE_ID,
        item.ts,
        item.t,
        item.h,
      );
    }

    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    await db.runAsync(
      `DELETE FROM measurements_cache
       WHERE device = ? AND ts < ?`,
      DEVICE_ID,
      sevenDaysAgo,
    );
  };

  const loadCachedMeasurements = async () => {
    try {
      const db = await getDatabase();
      const from = Math.floor(Date.now() / 1000) - 600;

      const rows = await db.getAllAsync<CachedMeasurement>(
        `SELECT device, ts, t, h
         FROM measurements_cache
         WHERE device = ? AND ts >= ?
         ORDER BY ts ASC`,
        DEVICE_ID,
        from,
      );

      if (rows.length) {
        setLiveMeasurements(rows);
        const last = rows[rows.length - 1];
        setTemperature(last.t);
        setHumidity(last.h);
      }
    } catch (error) {
      console.log('[CACHE] measurements', error);
    }
  };

  const loadCachedHistory = async (range: HistoryRange) => {
    try {
      const db = await getDatabase();
      const now = Math.floor(Date.now() / 1000);
      const from =
        range === '1h'
          ? now - 3600
          : range === '24h'
            ? now - 86400
            : now - 7 * 86400;

      const rows = await db.getAllAsync<CachedMeasurement>(
        `SELECT device, ts, t, h
         FROM measurements_cache
         WHERE device = ? AND ts >= ? AND ts <= ?
         ORDER BY ts ASC`,
        DEVICE_ID,
        from,
        now,
      );

      if (rows.length) setHistoryMeasurements(rows);
    } catch (error) {
      console.log('[CACHE] history', error);
    }
  };

  const saveDeviceToCache = async (device: Device) => {
    const db = await getDatabase();

    await db.runAsync(
      `INSERT OR REPLACE INTO devices_cache
       (id, group_name, status, last_seen, cached_at)
       VALUES (?, ?, ?, ?, ?)`,
      device.id,
      device.group,
      device.status,
      device.lastSeen ?? null,
      Math.floor(Date.now() / 1000),
    );
  };

  const loadCachedDevice = async () => {
    try {
      const db = await getDatabase();

      const row = await db.getFirstAsync<{ status: 'online' | 'offline' }>(
        `SELECT status FROM devices_cache WHERE id = ?`,
        DEVICE_ID,
      );

      if (row) setDeviceStatus(row.status);
    } catch (error) {
      console.log('[CACHE] device', error);
    }
  };

  const applyThresholdsToForm = (value: Thresholds) => {
    setThresholdForm({
      tMin: String(value.tMin),
      tMax: String(value.tMax),
      hMin: value.hMin == null ? '' : String(value.hMin),
      hMax: value.hMax == null ? '' : String(value.hMax),
      holdMinutes: String(value.holdMinutes),
    });
  };

  const saveThresholdsToCache = async (
    value: Thresholds,
    dirty: boolean,
  ) => {
    const db = await getDatabase();

    await db.runAsync(
      `INSERT OR REPLACE INTO thresholds_cache
       (device, t_min, t_max, h_min, h_max, hold_minutes, dirty, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      DEVICE_ID,
      value.tMin,
      value.tMax,
      value.hMin,
      value.hMax,
      value.holdMinutes,
      dirty ? 1 : 0,
      Math.floor(Date.now() / 1000),
    );

    setThresholdDirty(dirty);
  };

  const loadCachedThresholds = async () => {
    const db = await getDatabase();

    const row = await db.getFirstAsync<{
      t_min: number;
      t_max: number;
      h_min: number | null;
      h_max: number | null;
      hold_minutes: number;
      dirty: number;
    }>(
      `SELECT t_min, t_max, h_min, h_max, hold_minutes, dirty
       FROM thresholds_cache WHERE device = ?`,
      DEVICE_ID,
    );

    if (!row) return;

    const value: Thresholds = {
      tMin: row.t_min,
      tMax: row.t_max,
      hMin: row.h_min,
      hMax: row.h_max,
      holdMinutes: row.hold_minutes,
    };

    setThresholds(value);
    applyThresholdsToForm(value);
    setThresholdDirty(row.dirty === 1);
  };

  const loadThresholds = async () => {
    try {
      setThresholdLoading(true);

      const response = await fetch(
        `${API_URL}/devices/${DEVICE_ID}/thresholds`,
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: Thresholds = await response.json();

      setThresholds(data);
      applyThresholdsToForm(data);
      await saveThresholdsToCache(data, false);
    } catch {
      await loadCachedThresholds();
    } finally {
      setThresholdLoading(false);
    }
  };

  const parseThresholdForm = (): Thresholds | null => {
    const tMin = Number(thresholdForm.tMin.replace(',', '.'));
    const tMax = Number(thresholdForm.tMax.replace(',', '.'));
    const hMin =
      thresholdForm.hMin.trim() === ''
        ? null
        : Number(thresholdForm.hMin.replace(',', '.'));
    const hMax =
      thresholdForm.hMax.trim() === ''
        ? null
        : Number(thresholdForm.hMax.replace(',', '.'));
    const holdMinutes = Number(
      thresholdForm.holdMinutes.replace(',', '.'),
    );

    if (
      !Number.isFinite(tMin) ||
      !Number.isFinite(tMax) ||
      tMin >= tMax ||
      !Number.isFinite(holdMinutes) ||
      holdMinutes < 1 ||
      holdMinutes > 120
    ) {
      Alert.alert(
        'Seuils invalides',
        'Température : min < max. Durée : entre 1 et 120 minutes.',
      );
      return null;
    }

    if (
      (hMin != null && (hMin < 0 || hMin > 100)) ||
      (hMax != null && (hMax < 0 || hMax > 100)) ||
      (hMin != null && hMax != null && hMin >= hMax)
    ) {
      Alert.alert(
        'Humidité invalide',
        'Les seuils d’humidité doivent être compris entre 0 et 100 %, avec min < max.',
      );
      return null;
    }

    return {
      tMin,
      tMax,
      hMin,
      hMax,
      holdMinutes: Math.round(holdMinutes),
    };
  };

  const putThresholds = async (value: Thresholds) => {
    const response = await fetch(
      `${API_URL}/devices/${DEVICE_ID}/thresholds`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      },
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as Thresholds;
  };

  const saveThresholdSettings = async () => {
    const value = parseThresholdForm();
    if (!value) return;

    setThresholds(value);

    if (!networkConnected || !backendOnline) {
      await saveThresholdsToCache(value, true);
      await addJournalEntry(
        'thresholds',
        DEVICE_ID,
        'Seuils modifiés hors ligne — synchronisation en attente',
      );
      await refreshJournal();

      Alert.alert(
        'Enregistré hors ligne',
        'Les seuils seront envoyés automatiquement au retour du réseau.',
      );
      return;
    }

    try {
      setThresholdLoading(true);
      const saved = await putThresholds(value);

      setThresholds(saved);
      applyThresholdsToForm(saved);
      await saveThresholdsToCache(saved, false);

      await addJournalEntry(
        'thresholds',
        DEVICE_ID,
        `Seuils synchronisés — délai ${saved.holdMinutes} min`,
      );
      await refreshJournal();

      Alert.alert('Enregistré', 'Les seuils ont été mis à jour.');
    } catch {
      await saveThresholdsToCache(value, true);

      Alert.alert(
        'Connexion perdue',
        'Les seuils sont conservés localement.',
      );
    } finally {
      setThresholdLoading(false);
    }
  };

  const syncDirtyThresholds = async () => {
    try {
      const db = await getDatabase();

      const row = await db.getFirstAsync<{
        t_min: number;
        t_max: number;
        h_min: number | null;
        h_max: number | null;
        hold_minutes: number;
      }>(
        `SELECT t_min, t_max, h_min, h_max, hold_minutes
         FROM thresholds_cache
         WHERE device = ? AND dirty = 1`,
        DEVICE_ID,
      );

      if (!row) return;

      const saved = await putThresholds({
        tMin: row.t_min,
        tMax: row.t_max,
        hMin: row.h_min,
        hMax: row.h_max,
        holdMinutes: row.hold_minutes,
      });

      setThresholds(saved);
      applyThresholdsToForm(saved);
      await saveThresholdsToCache(saved, false);
      await addJournalEntry(
        'thresholds',
        DEVICE_ID,
        'Seuils hors ligne rejoués et confirmés',
      );
      await refreshJournal();
    } catch (error) {
      console.log('[THRESHOLDS] replay', error);
    }
  };

  const loadDevices = async () => {
    try {
      const response = await fetch(`${API_URL}/devices`);
      if (!response.ok) throw new Error('devices');

      const devices: Device[] = await response.json();
      const device = devices.find((item) => item.id === DEVICE_ID);

      if (device) {
        setDeviceStatus(device.status);
        await saveDeviceToCache(device);
      }

      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  };

  const loadLiveMeasurements = async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const from = now - 600;

      const response = await fetch(
        `${API_URL}/devices/${DEVICE_ID}/measurements?from=${from}&to=${now}`,
      );

      if (!response.ok) throw new Error('measurements');

      const data: Measurement[] = await response.json();

      setLiveMeasurements(data);
      await saveMeasurementsToCache(data);

      if (data.length) {
        const last = data[data.length - 1];
        setTemperature(last.t);
        setHumidity(last.h);
      }

      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
      await loadCachedMeasurements();
    } finally {
      setLiveLoading(false);
    }
  };

  const loadHistory = async (range: HistoryRange) => {
    try {
      setHistoryLoading(true);

      const now = Math.floor(Date.now() / 1000);
      const from =
        range === '1h'
          ? now - 3600
          : range === '24h'
            ? now - 86400
            : now - 7 * 86400;
      const step = range === '1h' ? 60 : range === '24h' ? 300 : 1800;

      const response = await fetch(
        `${API_URL}/devices/${DEVICE_ID}/measurements?from=${from}&to=${now}&step=${step}`,
      );

      if (!response.ok) throw new Error('history');

      const data: Measurement[] = await response.json();
      setHistoryMeasurements(data);
    } catch {
      await loadCachedHistory(range);
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshJournal = async () => {
    const db = await getDatabase();

    const rows = await db.getAllAsync<{
      id: number;
      type: string;
      message: string;
      created_at: number;
    }>(
      `SELECT id, type, message, created_at
       FROM journal
       ORDER BY created_at DESC
       LIMIT 80`,
    );

    const commands = await getAllCommands();

    const local: JournalItem[] = rows.map((row) => ({
      id: `j-${row.id}`,
      type: row.type,
      message: row.message,
      createdAt: row.created_at,
    }));

    const commandItems: JournalItem[] = commands.map((command) => ({
      id: `c-${command.id}`,
      type: 'command',
      message: `Veilleuse ${command.led ? 'ON' : 'OFF'} · ${command.status} · ${command.attempts} tentative(s)`,
      createdAt: command.createdAt,
    }));

    setJournalItems(
      [...local, ...commandItems]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 100),
    );
  };

  const restoreCommandState = async () => {
    const commands = await getAllCommands();
    if (!commands.length) return;

    const last = commands[0];
    setLedOn(last.led);
    setLedPending(
      last.status === 'pending' || last.status === 'sent',
    );
  };

  const sendCommand = async (command: QueuedCommand) => {
    try {
      await incrementCommandAttempts(command.id);

      const response = await fetch(
        `${API_URL}/devices/${command.device}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: command.id,
            led: command.led,
          }),
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const body = await response.json().catch(() => null);

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
  };

  const flushCommandQueue = async () => {
    if (isFlushingRef.current || !networkConnected) return;

    isFlushingRef.current = true;

    try {
      const commands = await getAllCommands();

      const replayable = commands
        .filter(
          (command) =>
            command.status === 'pending' ||
            command.status === 'sent',
        )
        .sort((a, b) => a.createdAt - b.createdAt);

      for (const command of replayable) {
        const ok = await sendCommand(command);
        if (!ok) break;
      }
    } finally {
      isFlushingRef.current = false;
    }
  };

  const toggleLed = async () => {
    const newValue = !ledOn;

    const command: QueuedCommand = {
      id: `c-${Crypto.randomUUID()}`,
      device: DEVICE_ID,
      led: newValue,
      status: 'pending',
      attempts: 0,
      createdAt: Math.floor(Date.now() / 1000),
    };

    setLedOn(newValue);
    setLedPending(true);

    await addCommand(command);
    await addJournalEntry(
      'command',
      DEVICE_ID,
      `Veilleuse ${newValue ? 'ON' : 'OFF'} — pending`,
    );
    await refreshJournal();

    if (networkConnected) {
      await sendCommand(command);
    }
  };

  const loadNotificationSetting = async () => {
    const db = await getDatabase();

    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'notifications'`,
    );

    setNotificationsEnabled(row?.value === '1');
  };

  const saveNotificationSetting = async (enabled: boolean) => {
    const db = await getDatabase();

    await db.runAsync(
      `INSERT OR REPLACE INTO app_settings (key, value)
       VALUES ('notifications', ?)`,
      enabled ? '1' : '0',
    );
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      await saveNotificationSetting(false);
      return;
    }

    const permission = await Notifications.requestPermissionsAsync();

    if (permission.status !== 'granted') {
      setNotificationsEnabled(false);
      await saveNotificationSetting(false);

      Alert.alert(
        'Notifications refusées',
        'Les alertes resteront visibles dans l’app et dans le Journal.',
      );
      return;
    }

    setNotificationsEnabled(true);
    await saveNotificationSetting(true);
  };

  const notifyLocal = async (title: string, body: string) => {
    if (!notificationsEnabled) return;

    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  };

  const connectWebSocket = () => {
    if (!networkConnected) return;

    wsRef.current?.close();

    const ws = new WebSocket(WS_URL);

    ws.onopen = async () => {
      setBackendOnline(true);
      await syncDirtyThresholds();
      await flushCommandQueue();
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.device !== DEVICE_ID) return;

        if (message.type === 'measurement') {
          const measurement: Measurement = {
            ts: message.ts,
            t: message.t,
            h: message.h,
          };

          setTemperature(message.t);
          setHumidity(message.h);

          setLiveMeasurements((previous) => {
            const minTs = Math.floor(Date.now() / 1000) - 600;
            return [...previous, measurement]
              .filter((item) => item.ts >= minTs)
              .sort((a, b) => a.ts - b.ts);
          });

          await saveMeasurementsToCache([measurement]);
        }

        if (message.type === 'device_status') {
          setDeviceStatus(message.status);

          await saveDeviceToCache({
            id: DEVICE_ID,
            group: GROUP_NAME,
            status: message.status,
          });

          await addJournalEntry(
            'device_status',
            DEVICE_ID,
            `Capteur ${message.status === 'online' ? 'en ligne' : 'hors ligne'}`,
          );

          await refreshJournal();
        }

        if (message.type === 'alert') {
          const alertData: AlertEvent = {
            kind: message.kind,
            value: message.value,
            threshold: message.threshold,
            ts: message.ts,
          };

          setActiveAlert(alertData);

          const text = describeAlert(alertData);

          await addJournalEntry('alert', DEVICE_ID, text);
          await refreshJournal();
          await notifyLocal('Alerte dans la chambre', text);
        }

        if (message.type === 'alert_cleared') {
          setActiveAlert(null);

          await addJournalEntry(
            'alert_cleared',
            DEVICE_ID,
            `Retour à la normale (${formatAlertKind(message.kind)})`,
          );

          await refreshJournal();
        }

        if (
          message.type === 'command_status' &&
          message.status === 'acked'
        ) {
          await updateCommandStatus(message.id, 'acked');
          setLedPending(false);

          await addJournalEntry(
            'command',
            DEVICE_ID,
            `Commande ${message.id} confirmée — acked`,
          );

          await refreshJournal();
        }
      } catch (error) {
        console.log('[WS] message', error);
      }
    };

    ws.onerror = () => setBackendOnline(false);
    ws.onclose = () => {
      if (networkConnected) setBackendOnline(false);
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      await initDatabase();
      await ensureExtraTables();

      await Promise.all([
        loadCachedDevice(),
        loadCachedMeasurements(),
        loadCachedHistory('1h'),
        loadCachedThresholds(),
        restoreCommandState(),
        loadNotificationSetting(),
        refreshJournal(),
      ]);

      setLiveLoading(false);

      await loadDevices();
      await loadLiveMeasurements();
      await loadHistory('1h');
      await loadThresholds();

      if (mounted) connectWebSocket();
    };

    start();

    const netSubscription = NetInfo.addEventListener((state) => {
      const connected =
        state.isConnected === true &&
        state.isInternetReachable !== false;

      setNetworkConnected(connected);

      if (!connected) {
        setBackendOnline(false);
        wsRef.current?.close();
        return;
      }

      loadDevices();
      loadLiveMeasurements();
      loadHistory(historyRange);
      loadThresholds();
      connectWebSocket();
      flushCommandQueue();
      syncDirtyThresholds();
    });

    const appSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') {
          loadDevices();
          loadLiveMeasurements();
          loadHistory(historyRange);
          loadThresholds();
          connectWebSocket();
        } else {
          wsRef.current?.close();
        }
      },
    );

    return () => {
      mounted = false;
      netSubscription();
      appSubscription.remove();
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (networkConnected) loadHistory(historyRange);
    else loadCachedHistory(historyRange);
  }, [historyRange]);

  const historyStats = useMemo(() => {
    if (!historyMeasurements.length) return null;

    const temps = historyMeasurements.map((item) => item.t);
    const hums = historyMeasurements.map((item) => item.h);
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
  }, [historyMeasurements]);

  const connectionLabel = !networkConnected
    ? 'Mode hors ligne'
    : !backendOnline
      ? 'Reconnexion'
      : deviceStatus === 'offline'
        ? 'Capteur hors ligne'
        : 'En direct';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <View style={styles.shell}>
        {!backendOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineTitle}>
              {!networkConnected
                ? 'Mode hors ligne'
                : 'Reconnexion en cours'}
            </Text>

            <Text style={styles.offlineText}>
              {lastMeasurement
                ? `Dernières données : ${formatDateTime(lastMeasurement.ts)}`
                : 'Aucune donnée locale disponible'}
            </Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.appName}>{APP_NAME}</Text>
              <Text style={styles.subtitle}>
                La chambre, tout doucement.
              </Text>
            </View>

            <View style={styles.connectionPill}>
              <View
                style={[
                  styles.dot,
                  backendOnline && deviceStatus === 'online'
                    ? styles.dotOnline
                    : styles.dotOffline,
                ]}
              />
              <Text style={styles.connectionText}>
                {connectionLabel}
              </Text>
            </View>
          </View>

          {activeTab === 'home' && (
            <>
              <Animated.View
                style={[
                  styles.stateCard,
                  roomState.kind === 'alert' && styles.stateAlert,
                  roomState.kind === 'warning' && styles.stateWarning,
                  { transform: [{ scale: activeAlert ? pulse : 1 }] },
                ]}
              >
                <Text style={styles.stateEmoji}>
                  {roomState.kind === 'alert'
                    ? '🚨'
                    : roomState.kind === 'warning'
                      ? '🌙'
                      : roomState.kind === 'good'
                        ? '🧸'
                        : '☁️'}
                </Text>

                <View style={{ flex: 1 }}>
                  <Text style={styles.stateTitle}>
                    {roomState.title}
                  </Text>
                  <Text style={styles.stateText}>
                    {roomState.text}
                  </Text>
                </View>
              </Animated.View>

              <View style={styles.metricRow}>
                <MetricCard
                  emoji="🌡️"
                  label="Température"
                  value={temperature}
                  unit="°C"
                  min={thresholds.tMin}
                  max={thresholds.tMax}
                />

                <MetricCard
                  emoji="💧"
                  label="Humidité"
                  value={humidity}
                  unit="%"
                  min={thresholds.hMin}
                  max={thresholds.hMax}
                />
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.eyebrow}>SEUILS DE CONFORT</Text>
                    <Text style={styles.cardTitle}>Surveillance</Text>
                  </View>

                  <Pressable
                    style={styles.smallButton}
                    onPress={() => setActiveTab('settings')}
                  >
                    <Text style={styles.smallButtonText}>Modifier</Text>
                  </Pressable>
                </View>

                <View style={styles.summaryRow}>
                  <ThresholdSummary
                    label="Température"
                    value={`${thresholds.tMin} – ${thresholds.tMax} °C`}
                  />
                  <ThresholdSummary
                    label="Humidité"
                    value={`${thresholds.hMin ?? '—'} – ${thresholds.hMax ?? '—'} %`}
                  />
                </View>

                <View style={styles.holdBox}>
                  <Text style={styles.holdEmoji}>⏱️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holdTitle}>
                      Délai avant alerte
                    </Text>
                    <Text style={styles.holdText}>
                      Une valeur doit rester hors seuil pendant{' '}
                      <Text style={styles.bold}>
                        {thresholds.holdMinutes} minute
                        {thresholds.holdMinutes > 1 ? 's' : ''}
                      </Text>{' '}
                      avant le déclenchement.
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.eyebrow}>VEILLEUSE</Text>
                    <Text style={styles.cardTitle}>
                      Lumière de la chambre
                    </Text>
                  </View>
                  <Text style={styles.bigEmoji}>
                    {ledOn ? '💡' : '🌙'}
                  </Text>
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 14 }}>
                    <Text style={styles.switchTitle}>
                      {ledOn ? 'Allumée' : 'Éteinte'}
                    </Text>
                    <Text style={styles.switchSubtitle}>
                      {ledPending
                        ? !networkConnected
                          ? 'Commande enregistrée — attente du réseau'
                          : 'Commande envoyée — attente de confirmation'
                        : 'État confirmé par le boîtier'}
                    </Text>
                  </View>

                  <Switch
                    value={ledOn}
                    onValueChange={toggleLed}
                    trackColor={{
                      false: '#E5DDD8',
                      true: '#F1C6BB',
                    }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {ledPending && (
                  <View style={styles.pending}>
                    <Text style={styles.pendingText}>
                      ⏳ En attente de confirmation
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.eyebrow}>APERÇU</Text>
                    <Text style={styles.cardTitle}>
                      10 dernières minutes
                    </Text>
                  </View>
                  <Text style={styles.liveText}>
                    {backendOnline ? '● LIVE' : '● CACHE'}
                  </Text>
                </View>

                {liveLoading ? (
                  <ActivityIndicator style={{ marginVertical: 32 }} />
                ) : (
                  <SoftChart
                    data={liveMeasurements}
                    valueKey="t"
                    unit="°C"
                    minThreshold={thresholds.tMin}
                    maxThreshold={thresholds.tMax}
                  />
                )}

                <Pressable
                  style={styles.softButton}
                  onPress={() => setActiveTab('history')}
                >
                  <Text style={styles.softButtonText}>
                    Voir tout l’historique
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {activeTab === 'history' && (
            <>
              <ScreenTitle
                eyebrow="HISTORIQUE"
                title="Évolution de la chambre"
                subtitle="Température et humidité enregistrées."
              />

              <View style={styles.segmented}>
                {(['1h', '24h', '7d'] as HistoryRange[]).map((item) => (
                  <Pressable
                    key={item}
                    style={[
                      styles.segment,
                      historyRange === item && styles.segmentActive,
                    ]}
                    onPress={() => setHistoryRange(item)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        historyRange === item &&
                          styles.segmentTextActive,
                      ]}
                    >
                      {item === '7d' ? '7 jours' : item}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Température</Text>
                {historyLoading ? (
                  <ActivityIndicator style={{ marginVertical: 32 }} />
                ) : (
                  <SoftChart
                    data={historyMeasurements}
                    valueKey="t"
                    unit="°C"
                    minThreshold={thresholds.tMin}
                    maxThreshold={thresholds.tMax}
                  />
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Humidité</Text>
                <SoftChart
                  data={historyMeasurements}
                  valueKey="h"
                  unit="%"
                  minThreshold={thresholds.hMin}
                  maxThreshold={thresholds.hMax}
                />
              </View>

              {historyStats && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Résumé</Text>

                  <Text style={styles.statHeader}>Température</Text>
                  <View style={styles.statsRow}>
                    <StatBox label="Min" value={`${historyStats.tMin.toFixed(1)}°`} />
                    <StatBox label="Moy." value={`${historyStats.tAvg.toFixed(1)}°`} />
                    <StatBox label="Max" value={`${historyStats.tMax.toFixed(1)}°`} />
                  </View>

                  <Text style={[styles.statHeader, { marginTop: 20 }]}>
                    Humidité
                  </Text>
                  <View style={styles.statsRow}>
                    <StatBox label="Min" value={`${historyStats.hMin.toFixed(1)}%`} />
                    <StatBox label="Moy." value={`${historyStats.hAvg.toFixed(1)}%`} />
                    <StatBox label="Max" value={`${historyStats.hMax.toFixed(1)}%`} />
                  </View>
                </View>
              )}
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <ScreenTitle
                eyebrow="RÉGLAGES"
                title="Seuils et alertes"
                subtitle="Adapte la surveillance de la chambre."
              />

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Température</Text>

                <View style={styles.inputRow}>
                  <SettingInput
                    label="Minimum"
                    value={thresholdForm.tMin}
                    unit="°C"
                    onChangeText={(value) =>
                      setThresholdForm((old) => ({
                        ...old,
                        tMin: value,
                      }))
                    }
                  />

                  <SettingInput
                    label="Maximum"
                    value={thresholdForm.tMax}
                    unit="°C"
                    onChangeText={(value) =>
                      setThresholdForm((old) => ({
                        ...old,
                        tMax: value,
                      }))
                    }
                  />
                </View>

                <Text style={[styles.cardTitle, { marginTop: 26 }]}>
                  Humidité
                </Text>

                <View style={styles.inputRow}>
                  <SettingInput
                    label="Minimum"
                    value={thresholdForm.hMin}
                    unit="%"
                    onChangeText={(value) =>
                      setThresholdForm((old) => ({
                        ...old,
                        hMin: value,
                      }))
                    }
                  />

                  <SettingInput
                    label="Maximum"
                    value={thresholdForm.hMax}
                    unit="%"
                    onChangeText={(value) =>
                      setThresholdForm((old) => ({
                        ...old,
                        hMax: value,
                      }))
                    }
                  />
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Délai avant alerte
                </Text>

                <Text style={styles.description}>
                  Le dépassement doit durer ce temps avant de devenir une alerte.
                </Text>

                <View style={styles.durationWrap}>
                  <TextInput
                    style={styles.durationInput}
                    value={thresholdForm.holdMinutes}
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      setThresholdForm((old) => ({
                        ...old,
                        holdMinutes: value,
                      }))
                    }
                  />
                  <Text style={styles.durationUnit}>minutes</Text>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <Text style={styles.cardTitle}>
                      Notifications locales
                    </Text>
                    <Text style={styles.description}>
                      La permission est demandée uniquement lorsque tu actives cette option.
                    </Text>
                  </View>

                  <Switch
                    value={notificationsEnabled}
                    onValueChange={toggleNotifications}
                    trackColor={{
                      false: '#E5DDD8',
                      true: '#CDE3D5',
                    }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              {thresholdDirty && (
                <View style={styles.syncBox}>
                  <Text style={styles.syncText}>
                    ☁️ Des seuils attendent leur synchronisation.
                  </Text>
                </View>
              )}

              <Pressable
                style={styles.saveButton}
                onPress={saveThresholdSettings}
                disabled={thresholdLoading}
              >
                <Text style={styles.saveButtonText}>
                  {thresholdLoading
                    ? 'Enregistrement…'
                    : 'Enregistrer les réglages'}
                </Text>
              </Pressable>
            </>
          )}

          {activeTab === 'journal' && (
            <>
              <ScreenTitle
                eyebrow="JOURNAL"
                title="Ce qui s’est passé"
                subtitle="Alertes, connexions et commandes."
              />

              <View style={styles.card}>
                {journalItems.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Aucun événement enregistré.
                  </Text>
                ) : (
                  journalItems.map((item) => (
                    <View key={item.id} style={styles.journalRow}>
                      <View style={styles.journalIcon}>
                        <Text>{journalIcon(item.type)}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.journalMessage}>
                          {item.message}
                        </Text>
                        <Text style={styles.journalDate}>
                          {formatDateTime(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}

          <View style={{ height: 110 }} />
        </ScrollView>

        <View style={styles.bottomNav}>
          <NavButton
            icon="🏠"
            label="Chambre"
            active={activeTab === 'home'}
            onPress={() => setActiveTab('home')}
          />
          <NavButton
            icon="📈"
            label="Historique"
            active={activeTab === 'history'}
            onPress={() => setActiveTab('history')}
          />
          <NavButton
            icon="⚙️"
            label="Réglages"
            active={activeTab === 'settings'}
            onPress={() => setActiveTab('settings')}
          />
          <NavButton
            icon="📖"
            label="Journal"
            active={activeTab === 'journal'}
            onPress={() => {
              refreshJournal();
              setActiveTab('journal');
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function MetricCard({
  emoji,
  label,
  value,
  unit,
  min,
  max,
}: {
  emoji: string;
  label: string;
  value: number | null;
  unit: string;
  min: number | null;
  max: number | null;
}) {
  const outside =
    value != null &&
    ((min != null && value < min) ||
      (max != null && value > max));

  return (
    <View
      style={[
        styles.metricCard,
        outside && styles.metricCardWarning,
      ]}
    >
      <Text style={styles.metricEmoji}>{emoji}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value == null ? '--' : value.toFixed(1)}
        <Text style={styles.metricUnit}> {unit}</Text>
      </Text>
      <Text style={styles.metricRange}>
        Confort : {min ?? '—'} – {max ?? '—'} {unit}
      </Text>
    </View>
  );
}

function ThresholdSummary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function ScreenTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.screenHeading}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.screenTitle}>{title}</Text>
      <Text style={styles.screenSubtitle}>{subtitle}</Text>
    </View>
  );
}

function SettingInput({
  label,
  value,
  unit,
  onChangeText,
}: {
  label: string;
  value: string;
  unit: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputInner}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
        />
        <Text style={styles.inputUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function NavButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.navButton,
        active && styles.navButtonActive,
      ]}
      onPress={onPress}
    >
      <Text style={styles.navIcon}>{icon}</Text>
      <Text
        style={[
          styles.navText,
          active && styles.navTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SoftChart({
  data,
  valueKey,
  unit,
  minThreshold,
  maxThreshold,
}: {
  data: Measurement[];
  valueKey: 't' | 'h';
  unit: string;
  minThreshold: number | null;
  maxThreshold: number | null;
}) {
  const width = 320;
  const height = 190;

  if (data.length < 2) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>
          Pas encore assez de données
        </Text>
      </View>
    );
  }

  const values = data.map((item) => item[valueKey]);
  const thresholdValues = [
    ...(minThreshold != null ? [minThreshold] : []),
    ...(maxThreshold != null ? [maxThreshold] : []),
  ];

  const minBase = Math.min(...values, ...thresholdValues);
  const maxBase = Math.max(...values, ...thresholdValues);
  const padding = Math.max((maxBase - minBase) * 0.15, 0.5);
  const min = minBase - padding;
  const max = maxBase + padding;
  const range = max - min || 1;

  const yFor = (value: number) =>
    height - 30 - ((value - min) / range) * (height - 60);

  const points = data
    .map((item, index) => {
      const x =
        14 +
        (index / Math.max(data.length - 1, 1)) * (width - 28);
      return `${x},${yFor(item[valueKey])}`;
    })
    .join(' ');

  const last = data[data.length - 1];

  return (
    <View style={styles.chartWrap}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 1, 2, 3].map((index) => {
          const y = 25 + index * 45;
          return (
            <Line
              key={index}
              x1="14"
              x2="306"
              y1={y}
              y2={y}
              stroke="#EFE7E2"
              strokeWidth="1"
            />
          );
        })}

        {minThreshold != null && (
          <Line
            x1="14"
            x2="306"
            y1={yFor(minThreshold)}
            y2={yFor(minThreshold)}
            stroke="#D8C8BF"
            strokeDasharray="4 4"
          />
        )}

        {maxThreshold != null && (
          <Line
            x1="14"
            x2="306"
            y1={yFor(maxThreshold)}
            y2={yFor(maxThreshold)}
            stroke="#D8C8BF"
            strokeDasharray="4 4"
          />
        )}

        <Polyline
          points={points}
          fill="none"
          stroke="#C98072"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <SvgText x="14" y="18" fontSize="11" fill="#9A8A82">
          {max.toFixed(1)} {unit}
        </SvgText>

        <SvgText
          x="14"
          y={height - 8}
          fontSize="11"
          fill="#9A8A82"
        >
          {min.toFixed(1)} {unit}
        </SvgText>

        <SvgText
          x="306"
          y="18"
          fontSize="12"
          textAnchor="end"
          fill="#6C605A"
          fontWeight="600"
        >
          {last[valueKey].toFixed(1)} {unit}
        </SvgText>
      </Svg>
    </View>
  );
}

function describeAlert(alert: AlertEvent) {
  const kind = formatAlertKind(alert.kind);

  if (alert.value == null || alert.threshold == null) {
    return `${kind} hors seuil`;
  }

  return `${kind} : ${alert.value.toFixed(1)} (seuil ${alert.threshold})`;
}

function formatAlertKind(kind: string) {
  if (kind === 'tMax') return 'Température trop élevée';
  if (kind === 'tMin') return 'Température trop basse';
  if (kind === 'hMax') return 'Humidité trop élevée';
  if (kind === 'hMin') return 'Humidité trop basse';
  return kind;
}

function journalIcon(type: string) {
  if (type === 'alert') return '🚨';
  if (type === 'alert_cleared') return '✅';
  if (type === 'device_status') return '📡';
  if (type === 'thresholds') return '🎚️';
  if (type === 'command') return '💡';
  return '•';
}

function formatDateTime(ts: number) {
  return new Date(ts * 1000).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF9F6',
  },
  shell: {
    flex: 1,
    backgroundColor: '#FFF9F6',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  offlineBanner: {
    backgroundColor: '#F5E5C8',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8D5B7',
  },
  offlineTitle: {
    color: '#7E6741',
    fontWeight: '800',
    fontSize: 13,
  },
  offlineText: {
    marginTop: 2,
    color: '#8D795A',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#5F514B',
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 2,
    color: '#9B8D86',
    fontSize: 13,
  },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0E6E1',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  dotOnline: {
    backgroundColor: '#7FB28C',
  },
  dotOffline: {
    backgroundColor: '#D9A19A',
  },
  connectionText: {
    color: '#766862',
    fontSize: 11,
    fontWeight: '700',
  },
  stateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F2EB',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D8E8DD',
  },
  stateWarning: {
    backgroundColor: '#FFF0D9',
    borderColor: '#F0D9B5',
  },
  stateAlert: {
    backgroundColor: '#FFE2DE',
    borderColor: '#F5BBB3',
  },
  stateEmoji: {
    fontSize: 34,
    marginRight: 14,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5E524C',
  },
  stateText: {
    marginTop: 4,
    color: '#84766F',
    fontSize: 13,
    lineHeight: 18,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0E7E2',
  },
  metricCardWarning: {
    backgroundColor: '#FFF5E8',
    borderColor: '#F0D2A8',
  },
  metricEmoji: {
    fontSize: 25,
  },
  metricLabel: {
    color: '#998B84',
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 3,
    fontSize: 27,
    fontWeight: '800',
    color: '#5C504A',
  },
  metricUnit: {
    fontSize: 15,
    color: '#877A73',
    fontWeight: '600',
  },
  metricRange: {
    marginTop: 8,
    color: '#A2948D',
    fontSize: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0E7E2',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eyebrow: {
    color: '#B28E83',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  cardTitle: {
    color: '#5E524C',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 3,
  },
  smallButton: {
    backgroundColor: '#FAEDEA',
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: '#A66F63',
    fontWeight: '800',
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#FFF8F5',
    padding: 13,
    borderRadius: 17,
  },
  summaryLabel: {
    color: '#A0928B',
    fontSize: 11,
  },
  summaryValue: {
    color: '#655850',
    fontWeight: '800',
    fontSize: 14,
    marginTop: 5,
  },
  holdBox: {
    flexDirection: 'row',
    marginTop: 13,
    backgroundColor: '#F8F3EA',
    borderRadius: 17,
    padding: 14,
  },
  holdEmoji: {
    fontSize: 21,
    marginRight: 11,
  },
  holdTitle: {
    color: '#6B5E55',
    fontWeight: '800',
    fontSize: 13,
  },
  holdText: {
    marginTop: 4,
    color: '#8A7D75',
    lineHeight: 18,
    fontSize: 12,
  },
  bold: {
    fontWeight: '800',
    color: '#6A5A52',
  },
  bigEmoji: {
    fontSize: 30,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#62564F',
  },
  switchSubtitle: {
    marginTop: 4,
    color: '#94867F',
    fontSize: 12,
    lineHeight: 17,
  },
  pending: {
    marginTop: 14,
    backgroundColor: '#FFF0D8',
    borderRadius: 15,
    padding: 11,
  },
  pendingText: {
    color: '#9A7442',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
  },
  liveText: {
    color: '#6C9D78',
    fontWeight: '800',
    fontSize: 11,
  },
  softButton: {
    backgroundColor: '#FAEFEC',
    borderRadius: 17,
    paddingVertical: 13,
    marginTop: 7,
  },
  softButtonText: {
    textAlign: 'center',
    color: '#9B6A60',
    fontWeight: '800',
  },
  screenHeading: {
    marginBottom: 18,
  },
  screenTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#5E514A',
    marginTop: 4,
  },
  screenSubtitle: {
    color: '#978A83',
    marginTop: 5,
    fontSize: 13,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#F4ECE8',
    padding: 4,
    borderRadius: 18,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 14,
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#95857D',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#7B5F56',
  },
  statHeader: {
    marginTop: 15,
    marginBottom: 9,
    color: '#9B8C84',
    fontSize: 11,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 9,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFF8F5',
    borderRadius: 16,
    padding: 13,
  },
  statLabel: {
    color: '#A0928B',
    fontSize: 11,
  },
  statValue: {
    marginTop: 3,
    color: '#62554E',
    fontWeight: '800',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 11,
    marginTop: 13,
  },
  inputBlock: {
    flex: 1,
  },
  inputLabel: {
    color: '#92847C',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 7,
  },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EADFD9',
    borderRadius: 16,
    backgroundColor: '#FFFDFC',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    color: '#62554F',
    fontSize: 16,
    fontWeight: '700',
  },
  inputUnit: {
    color: '#9C8E87',
  },
  description: {
    color: '#94867F',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  durationWrap: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationInput: {
    width: 85,
    backgroundColor: '#FFF8F5',
    borderWidth: 1,
    borderColor: '#EADFD9',
    borderRadius: 16,
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#62554F',
  },
  durationUnit: {
    marginLeft: 10,
    color: '#897C75',
    fontWeight: '700',
  },
  syncBox: {
    backgroundColor: '#F6ECD9',
    borderRadius: 17,
    padding: 13,
    marginBottom: 13,
  },
  syncText: {
    color: '#806C4D',
    fontSize: 12,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#C88678',
    borderRadius: 19,
    paddingVertical: 15,
    marginBottom: 14,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    fontSize: 14,
  },
  journalRow: {
    flexDirection: 'row',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1E8E3',
  },
  journalIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF4F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  journalMessage: {
    color: '#675A53',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
  },
  journalDate: {
    color: '#A2948D',
    fontSize: 10,
    marginTop: 4,
  },
  emptyChart: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#A1948D',
    textAlign: 'center',
  },
  chartWrap: {
    marginTop: 10,
  },
  bottomNav: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 6,
    borderWidth: 1,
    borderColor: '#EEE4DF',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 19,
  },
  navButtonActive: {
    backgroundColor: '#FAECE8',
  },
  navIcon: {
    fontSize: 18,
  },
  navText: {
    fontSize: 9,
    color: '#A0938B',
    marginTop: 2,
    fontWeight: '700',
  },
  navTextActive: {
    color: '#96695F',
  },
});

