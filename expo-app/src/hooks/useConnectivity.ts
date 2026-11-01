import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { createSentinelleSocket, type SnapshotAlert } from '@/api/websocket';
import { getToken } from '@/auth/tokenStore';
import { API_URL, DEVICE_ID, WS_URL } from '@/constants/config';
import type { AlertEvent, Measurement } from '@/types';
import { log } from '@/utils/logger';
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

type ConnectivityOptions = {
  authToken: string | null;
  connection: ConnectionState;
  /** Hydrates state from the local cache; runs once before the first sync. */
  bootstrap: () => Promise<void>;
  refreshAll: () => Promise<void>;
  /** Network came back after startup: replay offline work. */
  onReconnect: () => void;
  /** Network lost: fall back to cached data. */
  onOffline: () => void;
  socketHandlers: SocketHandlers;
};

/**
 * Owns the app lifecycle: cache bootstrap, NetInfo / AppState / auth
 * transitions and the ticket-authenticated WebSocket.
 */
export function useConnectivity(options: ConnectivityOptions): void {
  const { authToken } = options;

  // Subscriptions are created once; handlers are read through this ref so
  // they always see the latest callbacks without re-subscribing.
  const latestRef = useRef(options);
  useEffect(() => {
    latestRef.current = options;
  });

  const disconnectRef = useRef<(() => void) | null>(null);
  // Bumped on every connect/disconnect: a pending ticket lookup from an
  // older attempt (or from before unmount) must not open a socket.
  const connectGenRef = useRef(0);
  const readyRef = useRef(false);

  const disconnect = useCallback(() => {
    connectGenRef.current += 1;
    disconnectRef.current?.();
    disconnectRef.current = null;
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!latestRef.current.connection.networkRef.current) return;
    disconnect();
    const generation = connectGenRef.current;

    // Ticket issuance needs a session; skip silently when logged out
    // (the auth guard redirects to /login, and login re-triggers sync).
    void getToken().then((session) => {
      if (generation !== connectGenRef.current) return;
      const { connection } = latestRef.current;
      if (!session || !connection.networkRef.current) return;

      // A replaced socket still fires onClose/onError after disconnect():
      // ignore it so it can't mark the backend offline under the new one.
      const isCurrent = () => generation === connectGenRef.current;
      const run = (label: string, task: () => Promise<void>) => {
        if (!isCurrent()) return;
        task().catch((error) => log('ws', label, error));
      };
      const handlers = () => latestRef.current.socketHandlers;

      disconnectRef.current = createSentinelleSocket(WS_URL, API_URL, DEVICE_ID, {
        onOpen: () => {
          if (!isCurrent()) return;
          latestRef.current.connection.setBackend(true);
          run('open', () => handlers().onOpen());
        },
        onError: () => {
          if (isCurrent()) latestRef.current.connection.setBackend(false);
        },
        onClose: () => {
          const current = latestRef.current.connection;
          if (isCurrent() && current.networkRef.current) {
            current.setBackend(false);
          }
        },
        onMeasurement: (m) => run('measurement', () => handlers().onMeasurement(m)),
        onDeviceStatus: (status) =>
          run('device-status', () => handlers().onDeviceStatus(status)),
        onAlert: (alert) => run('alert', () => handlers().onAlert(alert)),
        onAlertCleared: (kind) =>
          run('alert-cleared', () => handlers().onAlertCleared(kind)),
        onSnapshot: (alerts) => run('snapshot', () => handlers().onSnapshot(alerts)),
        onCommandAcked: (id) => run('command-acked', () => handlers().onCommandAcked(id)),
      });
    });
  }, [disconnect]);

  useEffect(() => {
    let mounted = true;
    const refresh = () =>
      latestRef.current.refreshAll().catch((error) => log('net', 'refresh', error));

    const start = async () => {
      await latestRef.current.bootstrap();
      if (!mounted) return;
      await refresh();
      if (!mounted) return;
      connectWebSocket();
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
  }, [authToken, connectWebSocket, disconnect]);
}
