import type { AlertEvent, Measurement } from '@/types';
import { log } from '@/utils/logger';

export type WsCallbacks = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
  onMeasurement?: (m: Measurement) => void;
  onDeviceStatus?: (status: 'online' | 'offline') => void;
  onAlert?: (alert: AlertEvent) => void;
  onAlertCleared?: (kind: string) => void;
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

      if (message.device !== deviceId && message.type !== 'command_status') {
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
