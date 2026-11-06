import type { AlertEvent, Measurement } from '@/types';
import { getToken } from '@/auth/tokenStore';
import { fetchWsTicket } from './client';
import { pushWsTrace } from '@/utils/wsTrace';

export type SnapshotAlert = AlertEvent & { device: string };

export type WsCallbacks = {
  onOpen?: () => void;
  onClose?: (code?: number, reason?: string) => void;
  onError?: () => void;
  /** Human-readable connect progress; rendered verbatim on the debug card. */
  onEvent?: (message: string) => void;
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
 *
 * Every async step is raced against an external setTimeout deadline instead
 * of trusting fetch's AbortController: the field evidence is that a wedged
 * step produces NO event, NO error and (historically) NO network trace, so
 * attempts must be abandoned on a wall-clock deadline and retried fresh.
 */

// Stalled upgrades (tunnel reload, captive portal) never fire onerror.
const OPEN_TIMEOUT_MS = 12_000;
// A ticket fetch that produces nothing in 20s never will: abandon it.
const TICKET_DEADLINE_MS = 20_000;
// The token read has its own deadline so no await can silence the sequence.
const TOKEN_DEADLINE_MS = 8_000;

type Timed<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'error'; error: unknown }
  | { kind: 'timeout' };

function raceDeadline<T>(promise: Promise<T>, ms: number): Promise<Timed<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ kind: 'timeout' });
      }
    }, ms);
    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ kind: 'ok', value });
        }
      },
      (error) => {
        // Surface fast failures (401/429/DNS) immediately; only a promise
        // that NEVER settles has to wait for the deadline.
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ kind: 'error', error });
        }
      },
    );
  });
}

export function createSentinelleSocket(
  url: string,
  apiUrl: string,
  deviceId: string,
  cb: WsCallbacks,
): () => void {
  let closed = false;
  let ticketConsumed = false;
  let ws: WebSocket | null = null;
  let connectWatchdog: ReturnType<typeof setTimeout> | null = null;

  const fail = (message: string) => {
    if (closed) return;
    pushWsTrace(message);
    cb.onEvent?.(message);
    closed = true;
    cb.onError?.();
  };

  const describe = (error: unknown) => {
    if (error instanceof Error) {
      const cause = (error as { message?: string }).message;
      return `${error.name}${cause ? `: ${cause}` : ''}`;
    }
    return String(error);
  };

  void (async () => {
    // --- token -------------------------------------------------------------
    cb.onEvent?.('connecting · token…');
    let token: string | null = null;
    const tokenOutcome = await raceDeadline(getToken(), TOKEN_DEADLINE_MS);
    if (closed) return;
    if (tokenOutcome.kind === 'timeout') {
      fail(`token timeout (${TOKEN_DEADLINE_MS / 1000}s) — abandon`);
      return;
    }
    if (tokenOutcome.kind === 'error') {
      fail(`token error: ${String(tokenOutcome.error)}`);
      return;
    }
    token = tokenOutcome.value;
    if (!token) {
      // Not an error: logged out → the auth guard handles redirection and
      // login re-triggers the connect.
      closed = true;
      cb.onEvent?.('pas de session');
      return;
    }
    cb.onEvent?.('token ok');

    // --- ticket ------------------------------------------------------------
    cb.onEvent?.('connecting · ticket…');
    const ticketOutcome = await raceDeadline(
      fetchWsTicket(apiUrl),
      TICKET_DEADLINE_MS,
    );
    if (closed) return;
    if (ticketOutcome.kind === 'timeout') {
      fail(`ticket timeout (${TICKET_DEADLINE_MS / 1000}s) — abandon`);
      return;
    }
    if (ticketOutcome.kind === 'error') {
      fail(`ticket error: ${describe(ticketOutcome.error)}`);
      return;
    }
    const ticket = ticketOutcome.value.ticket;
    ticketConsumed = true;
    cb.onEvent?.('ticket 200');

    // --- upgrade -----------------------------------------------------------
    cb.onEvent?.('connecting · socket…');
    const socket = new WebSocket(
      `${url}${url.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`,
    );
    ws = socket;
    pushWsTrace('socket created');

    // A socket wedged in CONNECTING sends no onerror/onclose (RN has no
    // connect timeout): force the reconnect path ourselves.
    connectWatchdog = setTimeout(() => {
      connectWatchdog = null;
      if (closed) return;
      closed = true;
      pushWsTrace(`connect timeout (${OPEN_TIMEOUT_MS / 1000}s)`);
      cb.onEvent?.(`connect timeout (${OPEN_TIMEOUT_MS / 1000}s)`);
      cb.onError?.();
      socket.close();
    }, OPEN_TIMEOUT_MS);

    socket.onopen = () => {
      if (connectWatchdog) {
        clearTimeout(connectWatchdog);
        connectWatchdog = null;
      }
      pushWsTrace('open');
      cb.onOpen?.();
    };

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
              return rec.device === deviceId && typeof rec.kind === 'string';
            }),
          );
          return;
        }

        if (message.device !== deviceId && message.type !== 'command_status') {
          pushWsTrace(`filtered type=${message.type} device=${message.device}`);
          return;
        }

        if (message.type === 'measurement') {
          if (
            !Number.isInteger(message.ts) ||
            !Number.isFinite(message.t) ||
            !Number.isFinite(message.h)
          ) {
            pushWsTrace('invalid measurement frame');
            return;
          }
          cb.onMeasurement?.({ ts: message.ts, t: message.t, h: message.h });
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
        pushWsTrace(`message parse error: ${String(error)}`);
      }
    };

    socket.onerror = () => {
      if (closed) {
        pushWsTrace('transport error after timeout');
        return;
      }
      fail('transport error');
    };
    socket.onclose = (event) => {
      const code = (event as { code?: number }).code;
      const reason = (event as { reason?: string }).reason;
      if (closed) {
        pushWsTrace(`closed (late) code=${code ?? '?'}`);
        return;
      }
      closed = true;
      pushWsTrace(`closed code=${code ?? '?'}${reason ? ` ${reason}` : ''}`);
      cb.onClose?.(code, reason);
    };
  })();

  return () => {
    if (!closed && !ticketConsumed) {
      // Died mid-sequence before its deadline: say so, instead of vanishing.
      pushWsTrace('abandoned before ticket');
    }
    closed = true;
    if (connectWatchdog) {
      clearTimeout(connectWatchdog);
      connectWatchdog = null;
    }
    try {
      ws?.close();
    } catch {
      // already gone
    }
  };
}
