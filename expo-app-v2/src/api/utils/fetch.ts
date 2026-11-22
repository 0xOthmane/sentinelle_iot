import { TimeoutError } from '../errors';

export const REQUEST_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal ?? null;
  let timedOut = false;

  if (callerSignal?.aborted) {
    controller.abort();
  } else if (callerSignal) {
    callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new TimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}