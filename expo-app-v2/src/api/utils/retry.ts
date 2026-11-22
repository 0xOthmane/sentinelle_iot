import { AuthError, HttpError, RateLimitError, ResponseError, TimeoutError } from '../errors';

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof AuthError) return false;
  if (error instanceof ResponseError) return false;
  if (error instanceof TimeoutError) return failureCount < 2;
  if (error instanceof RateLimitError) return failureCount < 1;
  if (error instanceof HttpError) {
    if (error.isClientError && error.status !== 429) return false;
    return failureCount < 2;
  }
  return failureCount < 3;
}

export function retryDelay(attempt: number, error: unknown): number {
  if (error instanceof RateLimitError && error.retryAfterSeconds !== null) {
    return Math.min(error.retryAfterSeconds * 1000, 30_000);
  }
  return Math.min(1000 * 2 ** attempt, 10_000);
}