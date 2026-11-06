/**
 * Manual WS diagnostics: runs the exact same steps as the real connect path
 * (token → ticket → socket upgrade) and reports each one with a timing and
 * an error, so failures surface in the UI without Metro. The results also go
 * to Sentry breadcrumbs so standalone builds keep a trace of every attempt:
 * a step that times out here means the request never left the device.
 */
import { fetchWsTicket } from './client';
import { getToken } from '@/auth/tokenStore';
import * as Sentry from '@sentry/react-native';
import { log } from '@/utils/logger';

export type ProbeStep = {
  label: string;
  ok: boolean | null; // null: nothing happened within the deadline
  detail: string;
};

export type WsProbeResult = {
  steps: ProbeStep[];
  lines: string[];
};

// Generous on purpose: the runtime fetch also aborts at 15s, so a timeout
// here means even its error never surfaced (a truly wedged call).
const TOKEN_TIMEOUT_MS = 10_000;
const TICKET_TIMEOUT_MS = 20_000;
const OPEN_TIMEOUT_MS = 12_000;
const SNAPSHOT_WAIT_MS = 2_500;

type Timed<T> =
  | { kind: 'ok'; value: T; ms: number }
  | { kind: 'error'; error: unknown; ms: number }
  | { kind: 'timeout' };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<Timed<T>> {
  return new Promise((resolve) => {
    const started = Date.now();
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
          resolve({ kind: 'ok', value, ms: Date.now() - started });
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ kind: 'error', error, ms: Date.now() - started });
        }
      },
    );
  });
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { message?: string }).message;
    return `${error.name}${cause ? `: ${cause}` : ''}`;
  }
  return String(error);
}

async function probeToken(): Promise<ProbeStep> {
  const started = Date.now();
  const outcome = await withTimeout(getToken(), TOKEN_TIMEOUT_MS);
  switch (outcome.kind) {
    case 'ok':
      return {
        label: 'token',
        ok: outcome.value !== null,
        detail: `${outcome.value !== null ? 'présent' : 'ABSENT'} (${Date.now() - started} ms)`,
      };
    case 'error':
      return {
        label: 'token',
        ok: false,
        detail: `${describeError(outcome.error)} (${Date.now() - started} ms)`,
      };
    case 'timeout':
      return {
        label: 'token',
        ok: null,
        detail: `aucune réponse après ${TOKEN_TIMEOUT_MS / 1000}s (SecureStore bloqué ?)`,
      };
  }
}

async function probeTicket(
  apiUrl: string,
): Promise<{ step: ProbeStep; ticket: string | null }> {
  const started = Date.now();
  const outcome = await withTimeout(fetchWsTicket(apiUrl), TICKET_TIMEOUT_MS);
  switch (outcome.kind) {
    case 'ok':
      return {
        step: { label: 'ticket', ok: true, detail: `200 (${Date.now() - started} ms)` },
        ticket: outcome.value.ticket,
      };
    case 'error':
      return {
        step: {
          label: 'ticket',
          ok: false,
          detail: `${describeError(outcome.error)} (${Date.now() - started} ms)`,
        },
        ticket: null,
      };
    case 'timeout':
      return {
        step: {
          label: 'ticket',
          ok: null,
          detail: `AUCUNE RÉPONSE après ${TICKET_TIMEOUT_MS / 1000}s — la requête ne quitte pas le téléphone`,
        },
        ticket: null,
      };
  }
}

function probeSocket(wsUrl: string, ticket: string): Promise<ProbeStep> {
  return new Promise((resolve) => {
    const started = Date.now();
    const url = `${wsUrl}${wsUrl.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`;
    let ws: WebSocket | null = null;
    let settled = false;
    const finish = (step: ProbeStep) => {
      if (settled) return;
      settled = true;
      try {
        ws?.close();
      } catch {
        // already gone
      }
      resolve(step);
    };

    const openTimer = setTimeout(() => {
      finish({
        label: 'socket',
        ok: null,
        detail: `aucun événement après ${OPEN_TIMEOUT_MS / 1000}s (upgrade jamais initié ?)`,
      });
    }, OPEN_TIMEOUT_MS);

    let opened = false;
    let openMs = 0;
    let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      ws = new WebSocket(url);
    } catch (error) {
      clearTimeout(openTimer);
      finish({
        label: 'socket',
        ok: false,
        detail: `constructor: ${describeError(error)}`,
      });
      return;
    }
    const socket = ws;

    socket.onopen = () => {
      opened = true;
      openMs = Date.now() - started;
      clearTimeout(openTimer);
      snapshotTimer = setTimeout(() => {
        finish({
          label: 'socket',
          ok: true,
          detail: `ouvert en ${openMs} ms, aucun snapshot en ${SNAPSHOT_WAIT_MS / 1000}s`,
        });
      }, SNAPSHOT_WAIT_MS);
    };
    socket.onmessage = () => {
      if (snapshotTimer) clearTimeout(snapshotTimer);
      finish({
        label: 'socket',
        ok: true,
        detail: `ouvert en ${(opened ? openMs : Date.now() - started)} ms, snapshot reçu ✓`,
      });
    };
    socket.onerror = () => {
      if (snapshotTimer) clearTimeout(snapshotTimer);
      finish({
        label: 'socket',
        ok: false,
        detail: opened
          ? `erreur transport après ouverture (${Date.now() - started} ms)`
          : `erreur transport après ${Date.now() - started} ms (upgrade refusé ?)`,
      });
    };
    socket.onclose = (event) => {
      const code = (event as { code?: number }).code;
      if (snapshotTimer) clearTimeout(snapshotTimer);
      finish({
        label: 'socket',
        ok: opened,
        detail: opened
          ? `ouvert en ${openMs} ms, fermé ensuite (code=${code ?? '?'})`
          : `fermé sans ouverture (code=${code ?? '?'}) après ${Date.now() - started} ms`,
      });
    };
  });
}

export async function probeWsConnection(
  apiUrl: string,
  wsUrl: string,
): Promise<WsProbeResult> {
  const steps: ProbeStep[] = [];

  const tokenStep = await probeToken();
  steps.push(tokenStep);

  let ticket: string | null = null;
  if (tokenStep.ok !== false) {
    const { step: ticketStep, ticket: freshTicket } = await probeTicket(apiUrl);
    steps.push(ticketStep);
    ticket = freshTicket;
  }

  if (ticket) {
    steps.push(await probeSocket(wsUrl, ticket));
  } else {
    steps.push({ label: 'socket', ok: null, detail: 'ignoré (ticket indisponible)' });
  }

  const lines = steps.map(
    (step, index) =>
      `${index + 1}) ${step.label} : ${step.ok === null ? '⏳ BLOQUÉ' : step.ok ? '✓' : '✗'} — ${step.detail}`,
  );

  for (const line of lines) {
    log('ws', `probe ${line}`);
    Sentry.addBreadcrumb({
      category: 'ws.probe',
      message: line,
      level: 'info',
    });
  }

  return { steps, lines };
}
