import { DEFAULT_THRESHOLDS } from '@/constants/config';
import type {
  AlertEvent,
  Command,
  Device,
  FetchThresholdsResult,
  HistoryRange,
  LoginResponse,
  Measurement,
  Thresholds,
  WsTicket,
} from '@/types';
import { AuthError, HttpError, RateLimitError, ResponseError } from './errors';
import { fetchWithTimeout } from './utils/fetch';
import { authedFetch, getJson, parseRetryAfter } from './utils/http';
import { getMeasurements } from './utils/measurements';
import { rangeBounds, rangeStep } from './utils/history';
import {
  alertListSchema,
  commandResponseSchema,
  deviceListSchema,
  loginResponseSchema,
  thresholdsResponseSchema,
  thresholdsSchema,
  wsTicketSchema,
} from '@/types';

export { setUnauthorizedHandler } from './utils/http';

export type ApiRequestOptions = { signal?: AbortSignal };

export async function loginRequest(
  apiUrl: string,
  password: string,
  options?: ApiRequestOptions,
): Promise<LoginResponse> {
  const url = `${apiUrl}/auth/login`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    signal: options?.signal,
  });

  if (response.status === 401) throw new AuthError('Mot de passe incorrect');
  if (response.status === 429) {
    throw new RateLimitError(parseRetryAfter(response.headers.get('Retry-After')));
  }
  if (!response.ok) throw new HttpError(response.status);

  const body = await response.json().catch((error: unknown) => {
    throw new ResponseError(url, 'Response was not valid JSON', error);
  });
  const parsed = loginResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ResponseError(url, 'Response did not match the expected shape', parsed.error);
  }
  return parsed.data;
}

export async function fetchWsTicket(
  apiUrl: string,
  options?: ApiRequestOptions,
): Promise<WsTicket> {
  const url = `${apiUrl}/ws-ticket`;
  const response = await authedFetch(url, { signal: options?.signal });
  const body = await response.json().catch((error: unknown) => {
    throw new ResponseError(url, 'Response was not valid JSON', error);
  });
  const parsed = wsTicketSchema.safeParse(body);
  if (!parsed.success) {
    throw new ResponseError(url, 'Response did not match the expected shape', parsed.error);
  }
  return parsed.data;
}

export async function fetchDevices(
  apiUrl: string,
  options?: ApiRequestOptions,
): Promise<Device[]> {
  return getJson(`${apiUrl}/devices`, deviceListSchema, { signal: options?.signal });
}

export async function fetchLiveMeasurements(
  apiUrl: string,
  deviceId: string,
  windowSeconds: number = 600,
  options?: ApiRequestOptions,
): Promise<Measurement[]> {
  const now = Math.floor(Date.now() / 1000);
  return getMeasurements(
    `${apiUrl}/devices/${deviceId}/measurements?from=${now - windowSeconds}&to=${now}`,
    { signal: options?.signal },
  );
}

export async function fetchHistory(
  apiUrl: string,
  deviceId: string,
  range: HistoryRange,
  options?: ApiRequestOptions,
): Promise<Measurement[]> {
  const { from, to } = rangeBounds(range);
  const step = rangeStep(range);
  return getMeasurements(
    `${apiUrl}/devices/${deviceId}/measurements?from=${from}&to=${to}&step=${step}`,
    { signal: options?.signal },
  );
}

export async function fetchThresholds(
  apiUrl: string,
  deviceId: string,
  options?: ApiRequestOptions,
): Promise<FetchThresholdsResult> {
  const url = `${apiUrl}/devices/${deviceId}/thresholds`;
  const response = await getJson(url, thresholdsResponseSchema, {
    signal: options?.signal,
  });
  const { tMin, tMax, hMin, hMax } = response;

  if (tMin === null && tMax === null && hMin === null && hMax === null) {
    return { value: { ...DEFAULT_THRESHOLDS }, configured: false };
  }
  if (tMin === null || tMax === null) {
    throw new ResponseError(
      url,
      'Response did not match the expected shape: temperature bounds are missing',
      response,
    );
  }

  return { value: { ...response, tMin, tMax }, configured: true };
}

export async function fetchActiveAlerts(
  apiUrl: string,
  deviceId: string,
  options?: ApiRequestOptions,
): Promise<AlertEvent[]> {
  return getJson(
    `${apiUrl}/devices/${deviceId}/alerts/active`,
    alertListSchema,
    { signal: options?.signal },
  );
}

export async function registerPushToken(
  apiUrl: string,
  token: string,
  platform: 'android' | 'ios',
  options?: ApiRequestOptions,
): Promise<void> {
  await authedFetch(`${apiUrl}/notifications/push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform }),
    signal: options?.signal,
  });
}

export async function unregisterPushToken(
  apiUrl: string,
  token: string,
  options?: ApiRequestOptions,
): Promise<void> {
  await authedFetch(`${apiUrl}/notifications/push-token`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    signal: options?.signal,
  });
}

export async function putThresholds(
  apiUrl: string,
  deviceId: string,
  value: Thresholds,
  options?: ApiRequestOptions,
): Promise<Thresholds> {
  const url = `${apiUrl}/devices/${deviceId}/thresholds`;
  const response = await authedFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
    signal: options?.signal,
  });

  const body = await response.json().catch((error: unknown) => {
    throw new ResponseError(url, 'Response was not valid JSON', error);
  });
  const parsed = thresholdsSchema.safeParse(body);
  if (!parsed.success) {
    throw new ResponseError(url, 'Response did not match the expected shape', parsed.error);
  }
  return parsed.data;
}

export async function postCommand(
  apiUrl: string,
  deviceId: string,
  command: Command,
  options?: ApiRequestOptions,
): Promise<{ sent: boolean }> {
  const url = `${apiUrl}/devices/${deviceId}/commands`;
  const response = await authedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: command.id, led: command.led }),
    signal: options?.signal,
  });

  const body = await response.json().catch((error: unknown) => {
    throw new ResponseError(url, 'Response was not valid JSON', error);
  });
  const parsed = commandResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ResponseError(url, 'Response did not match the expected shape', parsed.error);
  }
  return { sent: parsed.data?.sent === true };
}

