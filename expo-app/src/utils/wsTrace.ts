import * as Sentry from '@sentry/react-native';

/**
 * In-memory ring buffer of socket-lifecycle events, rendered in the Settings
 * diagnostic card so a standalone EAS build always shows what the connect
 * sequence actually did (watchdog firings, stale attempts, close codes).
 * Every line is also sent to Sentry as a breadcrumb.
 */
const MAX_LINES = 14;

const entries: { t: number; msg: string }[] = [];

export function pushWsTrace(msg: string): void {
  entries.unshift({ t: Date.now(), msg });
  if (entries.length > MAX_LINES) entries.length = MAX_LINES;
  Sentry.addBreadcrumb({ category: 'ws', message: msg, level: 'info' });
}

export function getWsTraceLines(): string[] {
  return entries.map((entry) => {
    const time = new Date(entry.t).toLocaleTimeString('fr-FR', {
      hour12: false,
    });
    return `${time} ${entry.msg}`;
  });
}

export function clearWsTrace(): void {
  entries.length = 0;
}
