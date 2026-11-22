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

export class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export class TimeoutError extends Error {
  timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class ResponseError extends Error {
  url: string;
  details: unknown;
  constructor(url: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ResponseError';
    this.url = url;
    this.details = details;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}