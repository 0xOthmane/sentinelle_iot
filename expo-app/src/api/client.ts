import type {
  AlertEvent,
  Device,
  HistoryRange,
  Measurement,
  Thresholds,
} from '@/types';
import { rangeBounds, rangeStep } from '@/utils/format';
import { DEFAULT_THRESHOLDS } from '@/constants/config';
import { getToken } from '@/auth/tokenStore';
import { log } from '@/utils/logger';

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

/** Non-2xx answer from the API (the server was reached). */
export class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }

  /** 4xx: retrying the same request will fail again. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

// A request to a dead tunnel can hang for minutes; callers hold "in flight"
// guards while awaiting, so an unbounded wait would block every later sync.
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

type ThresholdResponse = Omit<Thresholds, 'tMin' | 'tMax'> & {
  tMin: number | null;
  tMax: number | null;
};

type MeasurementResponse = Omit<Measurement, 't' | 'h'> & {
  t: number | null;
  h: number | null;
};

function isCompleteMeasurement(
  measurement: MeasurementResponse,
): measurement is Measurement {
  return (
    Number.isFinite(measurement.t) &&
    Number.isFinite(measurement.h)
  );
}

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

  const response = await fetchWithTimeout(url, {
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
  if (!response.ok) throw new HttpError(response.status);
  return response;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await authedFetch(url);
  return (await response.json()) as T;
}

async function getMeasurements(url: string): Promise<Measurement[]> {
  const measurements = await getJson<MeasurementResponse[]>(url);
  const complete = measurements.filter(isCompleteMeasurement);
  if (complete.length < measurements.length) {
    log(
      'net',
      `${measurements.length - complete.length} incomplete measurement(s) ignored`,
    );
  }
  return complete;
}

export async function loginRequest(
  apiUrl: string,
  password: string,
): Promise<{ token: string; expiresAt: number }> {
  const response = await fetchWithTimeout(`${apiUrl}/auth/login`, {
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
  if (!response.ok) throw new HttpError(response.status);
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
  return getMeasurements(
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
  return getMeasurements(
    `${apiUrl}/devices/${deviceId}/measurements?from=${from}&to=${to}&step=${step}`,
  );
}

export async function fetchThresholds(
  apiUrl: string,
  deviceId: string,
): Promise<{ value: Thresholds; configured: boolean }> {
  const response = await getJson<ThresholdResponse>(
    `${apiUrl}/devices/${deviceId}/thresholds`,
  );
  const { tMin, tMax, hMin, hMax } = response;

  // The API answers with all-null bounds when the device has no saved
  // thresholds: it is not alerting yet, so callers must push real values.
  if (tMin === null && tMax === null && hMin === null && hMax === null) {
    return { value: { ...DEFAULT_THRESHOLDS }, configured: false };
  }
  if (tMin === null || tMax === null) {
    throw new Error('API returned thresholds without temperature bounds');
  }

  return { value: { ...response, tMin, tMax }, configured: true };
}

export async function fetchActiveAlerts(
  apiUrl: string,
  deviceId: string,
): Promise<AlertEvent[]> {
  return getJson<AlertEvent[]>(
    `${apiUrl}/devices/${deviceId}/alerts/active`,
  );
}

export async function registerPushToken(
  apiUrl: string,
  token: string,
  platform: 'android' | 'ios',
): Promise<void> {
  await authedFetch(`${apiUrl}/notifications/push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
  });
}

export async function unregisterPushToken(
  apiUrl: string,
  token: string,
): Promise<void> {
  await authedFetch(`${apiUrl}/notifications/push-token`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
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

/**
 * POST /devices/:id/commands answers `202 { sent }`: `sent` is true when the
 * API handed the command to the MQTT broker, false when the broker is down.
 */
export async function postCommand(
  apiUrl: string,
  deviceId: string,
  command: { id: string; led: boolean },
): Promise<{ sent: boolean }> {
  const response = await authedFetch(
    `${apiUrl}/devices/${deviceId}/commands`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: command.id, led: command.led }),
    },
  );

  const body = (await response.json().catch(() => null)) as {
    sent?: unknown;
  } | null;
  return { sent: body?.sent === true };
}
