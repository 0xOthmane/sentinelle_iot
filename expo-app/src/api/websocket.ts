import type { AlertEvent, Measurement } from '@/types';
import { log } from '@/utils/logger';
import { fetchWsTicket } from './client';

export type SnapshotAlert = AlertEvent & { device: string };

export type WsCallbacks = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
  onMeasurement?: (m: Measurement) => void;
  onDeviceStatus?: (status: 'online' | 'offline') => void;
  onAlert?: (alert: AlertEvent) => void;
  onAlertCleared?: (kind: string) => void;
  onSnapshot?: (alerts: SnapshotAlert[]) => void;
  onCommandAcked?: (id: string) => void;
};

/**
 * Thin transport wrapper: parses backend frames and fans out to typed
 * callbacks. All persistence / state updates live in the provider.
 *
 * Auth: React Native WebSockets cannot send Authorization headers, so we
 * fetch a one-time ticket via GET /ws-ticket (Bearer JWT) and connect to
 * `${url}?ticket=...`. The ticket is single-use with a short TTL.
 */
export function createSentinelleSocket(
  url: string,
  apiUrl: string,
  deviceId: string,
  cb: WsCallbacks,
): () => void {
  let closed = false;
  let ws: WebSocket | null = null;

  void (async () => {
    let ticket: string;
    try {
      ({ ticket } = await fetchWsTicket(apiUrl));
    } catch (error) {
      // No session (AuthError → logout already triggered) or rate-limited:
      // report as a socket error so the provider marks the backend offline.
      log('ws', 'ticket', error);
      if (!closed) cb.onError?.();
      return;
    }
    if (closed) return;

    const socket = new WebSocket(
      `${url}${url.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`,
    );
    ws = socket;

    socket.onopen = () => cb.onOpen?.();

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string);

      // Snapshot carries alerts for all devices: fan out before the
      // per-device filter so a reconnect always resyncs missed alerts.
      if (message.type === 'snapshot') {
        const alerts = Array.isArray(message.alerts) ? message.alerts : [];
        cb.onSnapshot?.(
          alerts.filter((a: unknown): a is SnapshotAlert => {
            if (!a || typeof a !== 'object') return false;
            const rec = a as Record<string, unknown>;
            return (
              rec.device === deviceId &&
              typeof rec.kind === 'string'
            );
          }),
        );
        return;
      }

      if (message.device !== deviceId && message.type !== 'command_status') {
        log('ws', `filtered type=${message.type} device=${message.device}`);
        return;
      }

      if (message.type === 'measurement') {
        cb.onMeasurement?.({
          ts: message.ts,
          t: message.t,
          h: message.h,
        });
      } else if (message.type === 'device_status') {
        cb.onDeviceStatus?.(message.status);
      } else if (message.type === 'alert') {
        cb.onAlert?.({
          kind: message.kind,
          value: message.value,
          threshold: message.threshold,
          ts: message.ts,
        });
      } else if (message.type === 'alert_cleared') {
        cb.onAlertCleared?.(message.kind);
      } else if (
        message.type === 'command_status' &&
        message.status === 'acked'
      ) {
        cb.onCommandAcked?.(message.id);
      }
    } catch (error) {
      log('ws', 'message', error);
    }
  };

  socket.onerror = () => cb.onError?.();
  socket.onclose = () => cb.onClose?.();
  });

  return () => {
    closed = true;
    ws?.close();
  };
}
