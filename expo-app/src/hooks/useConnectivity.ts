import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { createSentinelleSocket, type SnapshotAlert } from '@/api/websocket';
import { API_URL, DEVICE_ID, WS_URL } from '@/constants/config';
import type { AlertEvent, Measurement } from '@/types';
import { log } from '@/utils/logger';
import { pushWsTrace } from '@/utils/wsTrace';
import type { ConnectionState } from './useConnectionState';

export type SocketHandlers = {
  onOpen: () => Promise<void>;
  onMeasurement: (m: Measurement) => Promise<void>;
  onDeviceStatus: (status: 'online' | 'offline') => Promise<void>;
  onAlert: (alert: AlertEvent) => Promise<void>;
  onAlertCleared: (kind: string) => Promise<void>;
  onSnapshot: (alerts: SnapshotAlert[]) => Promise<void>;
  onCommandAcked: (id: string) => Promise<void>;
};

// Live-window sweep used only while the WebSocket is not open.
const FALLBACK_POLL_INTERVAL_MS = 25_000;

type ConnectivityOptions = {
  authToken: string | null;
  authReady: boolean;
  connection: ConnectionState;
  /** Hydrates state from the local cache; runs once before the first sync. */
  bootstrap: () => Promise<void>;
  refreshAll: () => Promise<void>;
  /** Network came back after startup: replay offline work. */
  onReconnect: () => void;
  /** Network lost: fall back to cached data. */
  onOffline: () => void;
  /** Socket not open: refill the live window so data can't go stale. */
  pollLive: () => Promise<void>;
  socketHandlers: SocketHandlers;
};

/**
 * Owns the app lifecycle: cache bootstrap, NetInfo / AppState / auth
 * transitions and the ticket-authenticated WebSocket.
 */
export function useConnectivity(options: ConnectivityOptions): {
  forceReconnect: () => void;
} {
  const { authToken, authReady } = options;

  // Subscriptions are created once; handlers are read through this ref so
  // they always see the latest callbacks without re-subscribing.
  const latestRef = useRef(options);
  useEffect(() => {
    latestRef.current = options;
  });

  const disconnectRef = useRef<(() => void) | null>(null);
  const connectWebSocketRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  // Monotonic tag displayed with every status/trace message: makes stale or
  // overlapping attempts identifiable at a glance on the debug card.
  const attemptCounterRef = useRef(0);
  // Bumped on every connect/disconnect: a pending ticket lookup from an
  // older attempt (or from before unmount) must not open a socket.
  const connectGenRef = useRef(0);
  const readyRef = useRef(false);

  // Fallback sweep while the socket can't stay open (wedged tunnel, phone
  // network oddity): without it live data freezes until an external
  // lifecycle event. Runs only while network is up, the app is in the
  // foreground and the WS is not; the WS remains the real-time path.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!readyRef.current) return;
      if (AppState.currentState !== 'active') return;
      const { connection, pollLive } = latestRef.current;
      if (!connection.networkRef.current) return;
      if (connection.backendRef.current) return;
      pollLive().catch((error) => log('net', 'poll', error));
    }, FALLBACK_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const disconnect = useCallback(() => {
    connectGenRef.current += 1;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    disconnectRef.current?.();
    disconnectRef.current = null;
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!latestRef.current.connection.networkRef.current) {
      log('ws', 'connect skipped: offline');
      latestRef.current.connection.setWsStatus('skipped : hors ligne');
      return;
    }
    disconnect();
    const generation = connectGenRef.current;
    const connection = latestRef.current.connection;
    attemptCounterRef.current += 1;
    const attempt = attemptCounterRef.current;

    const isCurrent = () => generation === connectGenRef.current;
    const scheduleReconnect = () => {
      if (
        !isCurrent() ||
        !latestRef.current.connection.networkRef.current ||
        reconnectTimerRef.current
      ) {
        return;
      }
      const delay = Math.min(
        30_000,
        1_000 * 2 ** reconnectAttemptRef.current,
      );
      reconnectAttemptRef.current += 1;
      latestRef.current.connection.setWsStatus(
        `retry #${reconnectAttemptRef.current} in ${Math.round(delay / 1000)}s`,
      );
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (isCurrent()) connectWebSocketRef.current?.();
      }, delay);
    };

    pushWsTrace(`attempt #${attempt} start`);
    connection.setWsStatus(`#${attempt} start`);

    disconnectRef.current = createSentinelleSocket(
      WS_URL,
      API_URL,
      DEVICE_ID,
      {
        // Status text from any attempt is truthful for that attempt (tag it
        // so overlaps are visible); only the current attempt affects backend
        // state or schedules reconnects.
        onEvent: (message) => {
          if (!isCurrent()) {
            pushWsTrace(`#${attempt} ${message} (stale)`);
            return;
          }
          connection.setWsStatus(`#${attempt} ${message}`);
        },
        onOpen: () => {
          if (!isCurrent()) return;
          reconnectAttemptRef.current = 0;
          connection.setBackend(true);
          connection.setWsStatus(`#${attempt} open`);
          const { socketHandlers: handlers } = latestRef.current;
          handlers
            .onOpen()
            .catch((error) => log('ws', 'open', error));
        },
        onError: () => {
          if (!isCurrent()) {
            pushWsTrace(`#${attempt} error dropped (stale)`);
            return;
          }
          connection.setBackend(false);
          scheduleReconnect();
        },
        onClose: (code, reason) => {
          const current = latestRef.current.connection;
          if (!isCurrent() || !current.networkRef.current) return;
          current.setBackend(false);
          current.setWsStatus(
            `#${attempt} closed (code=${code ?? '?'}${reason ? ` ${reason}` : ''})`,
          );
          scheduleReconnect();
        },
        onMeasurement: (m) => {
          if (!isCurrent()) return;
          void latestRef.current.socketHandlers
            .onMeasurement(m)
            .catch((error) => log('ws', 'measurement', error));
        },
        onDeviceStatus: (status) => {
          if (!isCurrent()) return;
          void latestRef.current.socketHandlers
            .onDeviceStatus(status)
            .catch((error) => log('ws', 'device-status', error));
        },
        onAlert: (alert) => {
          if (!isCurrent()) return;
          void latestRef.current.socketHandlers
            .onAlert(alert)
            .catch((error) => log('ws', 'alert', error));
        },
        onAlertCleared: (kind) => {
          if (!isCurrent()) return;
          void latestRef.current.socketHandlers
            .onAlertCleared(kind)
            .catch((error) => log('ws', 'alert-cleared', error));
        },
        onSnapshot: (alerts) => {
          if (!isCurrent()) return;
          void latestRef.current.socketHandlers
            .onSnapshot(alerts)
            .catch((error) => log('ws', 'snapshot', error));
        },
        onCommandAcked: (id) => {
          if (!isCurrent()) return;
          void latestRef.current.socketHandlers
            .onCommandAcked(id)
            .catch((error) => log('ws', 'command-acked', error));
        },
      },
    );
  }, [disconnect]);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  useEffect(() => {
    let mounted = true;
    const refresh = () =>
      latestRef.current.refreshAll().catch((error) => log('net', 'refresh', error));

    const start = async () => {
      try {
        await latestRef.current.bootstrap();
        if (!mounted) return;
        await refresh();
      } catch (error) {
        // Individual loaders have their own catch/fallback; this guards the
        // sequence itself (e.g. an unexpected bootstrap throw).
        log('cache', 'start', error);
      }
      if (!mounted) return;
      // Do not start a token lookup while SecureStore authentication is still
      // hydrating. The auth transition effect owns the first authenticated
      // connection once readiness and the token are both known.
      if (latestRef.current.authReady && latestRef.current.authToken) {
        connectWebSocket();
      } else {
        latestRef.current.connection.setWsStatus(
          latestRef.current.authReady ? 'pas de session' : 'authentification…',
        );
      }
      readyRef.current = true;
    };
    start().catch((error) => log('cache', 'start', error));

    const netSubscription = NetInfo.addEventListener((state) => {
      const { connection } = latestRef.current;
      const connected =
        state.isConnected === true && state.isInternetReachable !== false;
      connection.setNetwork(connected);

      if (!connected) {
        connection.setBackend(false);
        disconnect();
        latestRef.current.onOffline();
        return;
      }

      void refresh();
      // NetInfo fires immediately on subscribe while start() is still
      // running: the socket and replays are left to start() in that case
      // (refreshAll itself is guarded against overlapping runs).
      if (!readyRef.current) return;
      connectWebSocket();
      latestRef.current.onReconnect();
    });

    const appSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (!readyRef.current) return;
        void refresh();
        connectWebSocket();
      } else {
        disconnect();
      }
    });

    return () => {
      mounted = false;
      readyRef.current = false;
      netSubscription();
      appSubscription.remove();
      disconnect();
    };
  }, [connectWebSocket, disconnect]);

  // Auth transitions: after login, sync + open the ticket-authed socket;
  // after logout/401-expiry, drop the socket (HTTP already fails fast).
  useEffect(() => {
    if (!readyRef.current) return;
    if (authToken) {
      latestRef.current
        .refreshAll()
        .catch((error) => log('net', 'refresh', error));
      connectWebSocket();
    } else {
      disconnect();
      // Deferred so the logout transition doesn't trigger a cascading
      // render inside the effect body (react-hooks/set-state-in-effect).
      queueMicrotask(() => latestRef.current.connection.setBackend(false));
    }
  }, [authReady, authToken, connectWebSocket, disconnect]);

  const forceReconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    connectWebSocketRef.current?.();
  }, []);

  return { forceReconnect };
}
