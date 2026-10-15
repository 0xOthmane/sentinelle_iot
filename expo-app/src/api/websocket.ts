import type { AlertEvent, Measurement } from '@/types';
import { log } from '@/utils/logger';

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
 */
export function createSentinelleSocket(
  url: string,
  deviceId: string,
  cb: WsCallbacks,
): () => void {
  const ws = new WebSocket(url);

  ws.onopen = () => cb.onOpen?.();

  ws.onmessage = (event) => {
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

  ws.onerror = () => cb.onError?.();
  ws.onclose = () => cb.onClose?.();

  return () => ws.close();
}
