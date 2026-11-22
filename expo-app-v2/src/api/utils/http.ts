import type { z } from 'zod';

import { getToken } from '@/auth/tokenStore';
import { AuthError, HttpError, RateLimitError, ResponseError } from '../errors';
import { fetchWithTimeout } from './fetch';

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) ? seconds : null;
}

export async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
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
    throw new RateLimitError(parseRetryAfter(response.headers.get('Retry-After')));
  }
  if (!response.ok) throw new HttpError(response.status);
  return response;
}

export async function getJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await authedFetch(url, init);
  const body = await response.json().catch((error: unknown) => {
    throw new ResponseError(url, 'Response was not valid JSON', error);
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ResponseError(url, 'Response did not match the expected shape', parsed.error);
  }
  return parsed.data;
}