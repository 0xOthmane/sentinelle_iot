import * as Sentry from '@sentry/react-native';

import {
  fetchActiveAlerts,
  fetchDevices,
  fetchLiveMeasurements,
  fetchWsTicket,
} from '@/api/client';
import { AuthError, RateLimitError } from '@/api/errors';
import { API_URL, DEVICE_ID, WS_URL } from '@/constants/config';
import { LIVE_WINDOW_SECONDS, useLiveStore } from '@/stores/live-store';
import { liveFrameSchema, toAlertEvent } from '@/types/ws';
import { syncLedFromAlerts } from './led-controller';

// React Native has no connect timeout: a socket wedged in CONNECTING emits
// neither onerror nor onclose, so attempts need a wall-clock deadline.
const OPEN_TIMEOUT_MS = 12_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_MAX_OVERRIDE_MS = 60_000;

let socket: WebSocket | null = null;
let openWatchdog: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;
let attempt = 0;
let active = false;

function isCurrent(gen: number): boolean {
  return active && gen === generation;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function clearOpenWatchdog(): void {
  if (openWatchdog !== null) {
    clearTimeout(openWatchdog);
    openWatchdog = null;
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeSocket(ws: WebSocket): void {
  ws.onopen = null;
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;
  try {
    ws.close();
  } catch {
    // Already closed or never opened.
  }
}

function reportFrameError(
  operation: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  Sentry.captureException(
    error instanceof Error ? error : new Error(String(error)),
    {
      tags: { feature: 'live', operation },
      extra,
    },
  );
}

function reportBackfillFailure(resource: string, reason: unknown): void {
  // A 401 is already handled by the shared unauthorized handler.
  if (reason instanceof AuthError) return;
  Sentry.logger.warn('Live backfill failed', {
    resource,
    reason: describeError(reason),
  });
}

function scheduleReconnect(gen: number, overrideDelayMs?: number): void {
  if (!isCurrent(gen) || reconnectTimer !== null) return;

  attempt += 1;
  const backoff = Math.min(
    RECONNECT_MAX_MS,
    RECONNECT_BASE_MS * 2 ** (attempt - 1),
  );
  const delay =
    overrideDelayMs === undefined
      ? backoff
      : Math.min(
          Math.max(overrideDelayMs, RECONNECT_BASE_MS),
          RECONNECT_MAX_OVERRIDE_MS,
        );

  useLiveStore.getState().setConnection('reconnecting');
  Sentry.logger.warn('Live socket reconnecting', { attempt, delayMs: delay });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!isCurrent(gen)) return;
    void connect(gen);
  }, delay);
}

function handleConnectError(gen: number, error: unknown): void {
  if (!isCurrent(gen)) return;

  // The ticket fetch already triggered sign-out through the unauthorized
  // handler; the auth provider effect will stop and reset the store.
  if (error instanceof AuthError) {
    Sentry.logger.warn('Live ticket rejected', { deviceId: DEVICE_ID });
    active = false;
    generation += 1;
    useLiveStore.getState().setConnection('idle');
    return;
  }

  if (error instanceof RateLimitError && error.retryAfterSeconds !== null) {
    Sentry.logger.warn('Live ticket rate limited', {
      retryAfterSeconds: error.retryAfterSeconds,
    });
    scheduleReconnect(gen, error.retryAfterSeconds * 1000);
    return;
  }

  Sentry.logger.warn('Live ticket request failed', {
    reason: describeError(error),
  });
  scheduleReconnect(gen);
}

function handleSocketLost(gen: number, ws: WebSocket): void {
  if (!isCurrent(gen) || socket !== ws) return;
  socket = null;
  clearOpenWatchdog();
  closeSocket(ws);
  scheduleReconnect(gen);
}

function handleFrame(raw: unknown): void {
  if (typeof raw !== 'string') {
    reportFrameError(
      'parse-frame',
      new Error('Unexpected non-text live frame'),
      { payloadType: typeof raw },
    );
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    reportFrameError('parse-json', error, { length: raw.length });
    return;
  }

  const parsed = liveFrameSchema.safeParse(payload);
  if (!parsed.success) {
    reportFrameError('parse-schema', parsed.error, {
      frameType:
        payload && typeof payload === 'object' && 'type' in payload
          ? String((payload as { type: unknown }).type)
          : 'unknown',
    });
    return;
  }

  const frame = parsed.data;
  const store = useLiveStore.getState();
  const previousAlerts = store.activeAlerts;

  // Snapshot carries alerts for every device; filter before reconciling.
  if (frame.type === 'snapshot') {
    store.applySnapshot(
      frame.alerts
        .filter((alert) => alert.device === DEVICE_ID)
        .map(toAlertEvent),
    );
    syncLedFromAlerts(previousAlerts, useLiveStore.getState().activeAlerts);
    return;
  }

  if (frame.device !== DEVICE_ID) return;

  switch (frame.type) {
    case 'measurement':
      if (frame.t === null || frame.h === null) {
        Sentry.logger.warn('Incomplete live measurement ignored', {
          ts: frame.ts,
        });
        return;
      }
      store.ingestMeasurement({ ts: frame.ts, t: frame.t, h: frame.h });
      return;
    case 'device_status':
      store.setDeviceStatus(frame.status);
      return;
    case 'alert':
      store.ingestAlert(toAlertEvent(frame));
      syncLedFromAlerts(previousAlerts, useLiveStore.getState().activeAlerts);
      return;
    case 'alert_cleared': {
      const hadAlert = frame.kind in previousAlerts;
      store.clearAlert(frame.kind);
      if (hadAlert) {
        syncLedFromAlerts(previousAlerts, useLiveStore.getState().activeAlerts);
      }
      return;
    }
  }
}

async function backfill(gen: number): Promise<void> {
  const [devices, live, alerts] = await Promise.allSettled([
    fetchDevices(API_URL),
    fetchLiveMeasurements(API_URL, DEVICE_ID, LIVE_WINDOW_SECONDS),
    fetchActiveAlerts(API_URL, DEVICE_ID),
  ]);

  if (!isCurrent(gen) || useLiveStore.getState().connection !== 'open') return;
  const store = useLiveStore.getState();

  if (devices.status === 'fulfilled') {
    const device = devices.value.find((item) => item.id === DEVICE_ID);
    if (device) store.setDeviceStatus(device.status);
  } else {
    reportBackfillFailure('devices', devices.reason);
  }

  if (live.status === 'fulfilled') {
    store.applyMeasurements(live.value);
  } else {
    reportBackfillFailure('measurements', live.reason);
  }

  if (alerts.status === 'fulfilled') {
    const previousAlerts = store.activeAlerts;
    store.applySnapshot(alerts.value);
    syncLedFromAlerts(previousAlerts, useLiveStore.getState().activeAlerts);
  } else {
    reportBackfillFailure('alerts', alerts.reason);
  }
}

async function connect(gen: number): Promise<void> {
  if (!isCurrent(gen)) return;

  useLiveStore
    .getState()
    .setConnection(attempt === 0 ? 'connecting' : 'reconnecting');

  let ticket: string;
  try {
    const result = await fetchWsTicket(API_URL);
    ticket = result.ticket;
  } catch (error) {
    handleConnectError(gen, error);
    return;
  }

  if (!isCurrent(gen)) return;

  const separator = WS_URL.includes('?') ? '&' : '?';
  const url = `${WS_URL}${separator}ticket=${encodeURIComponent(ticket)}`;

  let ws: WebSocket;
  try {
    ws = new WebSocket(url);
  } catch (error) {
    reportFrameError('socket-create', error);
    scheduleReconnect(gen);
    return;
  }

  socket = ws;

  openWatchdog = setTimeout(() => {
    openWatchdog = null;
    if (!isCurrent(gen) || socket !== ws) return;
    Sentry.logger.warn('Live socket open timed out', {
      timeoutMs: OPEN_TIMEOUT_MS,
      attempt,
    });
    handleSocketLost(gen, ws);
  }, OPEN_TIMEOUT_MS);

  ws.onopen = () => {
    if (!isCurrent(gen) || socket !== ws) {
      closeSocket(ws);
      return;
    }

    clearOpenWatchdog();
    attempt = 0;
    useLiveStore.getState().setConnection('open');
    Sentry.logger.info('Live socket connected', { deviceId: DEVICE_ID });
    void backfill(gen);
  };

  ws.onmessage = (event) => {
    if (!isCurrent(gen) || socket !== ws) return;
    handleFrame(event.data);
  };

  ws.onerror = () => {
    if (!isCurrent(gen)) return;
    Sentry.logger.warn('Live socket error', { attempt });
    handleSocketLost(gen, ws);
  };

  ws.onclose = (event) => {
    if (!isCurrent(gen)) return;
    Sentry.logger.warn('Live socket closed', {
      code: event.code,
      reason: event.reason || undefined,
      attempt,
    });
    handleSocketLost(gen, ws);
  };
}

/** Opens the live socket. Safe to call repeatedly; only one connection runs. */
export function startLiveConnection(): void {
  if (active) return;
  active = true;
  attempt = 0;
  const gen = ++generation;
  void connect(gen);
}

/** Stops reconnecting and closes the current socket. */
export function stopLiveConnection(): void {
  active = false;
  generation += 1;
  clearReconnectTimer();
  clearOpenWatchdog();

  const current = socket;
  socket = null;
  if (current) closeSocket(current);

  useLiveStore.getState().setConnection('idle');
}
