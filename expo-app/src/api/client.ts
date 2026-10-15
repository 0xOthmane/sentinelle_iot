import type {
  AlertEvent,
  Device,
  HistoryRange,
  Measurement,
  Thresholds,
} from '@/types';
import { rangeBounds, rangeStep } from '@/utils/format';
import { getToken } from '@/auth/tokenStore';

export class AuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends Error {
  retryAfterSeconds: number | null;
  constructor(retryAfterSeconds: number | null = null) {
    super('Too many requests');
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) ? seconds : null;
}

async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  if (!token) throw new AuthError('No session — please log in');

  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    unauthorizedHandler?.();
    throw new AuthError('Session expired — please log in again');
  }
  if (response.status === 429) {
    throw new RateLimitError(
      parseRetryAfter(response.headers.get('Retry-After')),
    );
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await authedFetch(url);
  return (await response.json()) as T;
}

export async function loginRequest(
  apiUrl: string,
  password: string,
): Promise<{ token: string; expiresAt: number }> {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (response.status === 401) throw new AuthError('Mot de passe incorrect');
  if (response.status === 429) {
    throw new RateLimitError(
      parseRetryAfter(response.headers.get('Retry-After')),
    );
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as { token: string; expiresAt: number };
}

export async function fetchWsTicket(apiUrl: string): Promise<{
  ticket: string;
  expiresIn: number;
}> {
  const response = await authedFetch(`${apiUrl}/ws-ticket`);
  return (await response.json()) as { ticket: string; expiresIn: number };
}

export async function fetchDevices(apiUrl: string): Promise<Device[]> {
  return getJson<Device[]>(`${apiUrl}/devices`);
}

export async function fetchLiveMeasurements(
  apiUrl: string,
  deviceId: string,
  windowSeconds = 600,
): Promise<Measurement[]> {
  const now = Math.floor(Date.now() / 1000);
  return getJson<Measurement[]>(
    `${apiUrl}/devices/${deviceId}/measurements?from=${now - windowSeconds}&to=${now}`,
  );
}

export async function fetchHistory(
  apiUrl: string,
  deviceId: string,
  range: HistoryRange,
): Promise<Measurement[]> {
  const { from, to } = rangeBounds(range);
  const step = rangeStep(range);
  return getJson<Measurement[]>(
    `${apiUrl}/devices/${deviceId}/measurements?from=${from}&to=${to}&step=${step}`,
  );
}

export async function fetchThresholds(
  apiUrl: string,
  deviceId: string,
): Promise<Thresholds> {
  return getJson<Thresholds>(`${apiUrl}/devices/${deviceId}/thresholds`);
}

export async function fetchActiveAlerts(
  apiUrl: string,
  deviceId: string,
): Promise<AlertEvent[]> {
  return getJson<AlertEvent[]>(
    `${apiUrl}/devices/${deviceId}/alerts/active`,
  );
}

export async function putThresholds(
  apiUrl: string,
  deviceId: string,
  value: Thresholds,
): Promise<Thresholds> {
  const response = await authedFetch(
    `${apiUrl}/devices/${deviceId}/thresholds`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    },
  );

  return (await response.json()) as Thresholds;
}

export async function postCommand(
  apiUrl: string,
  deviceId: string,
  command: { id: string; led: boolean },
): Promise<{ status?: string } | null> {
  const response = await authedFetch(
    `${apiUrl}/devices/${deviceId}/commands`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: command.id, led: command.led }),
    },
  );

  return (await response.json().catch(() => null)) as {
    status?: string;
  } | null;
}
