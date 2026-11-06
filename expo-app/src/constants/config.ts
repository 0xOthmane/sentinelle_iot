import Constants from 'expo-constants';

const extra =
  (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

function configuredValue(
  value: string | undefined,
  extraValue: string | undefined,
  fallback: string,
): string {
  return value ?? extraValue ?? fallback;
}

const DEFAULT_HOST = '10.22.57.36:3003';

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '');
}

const configuredApi = configuredValue(
  process.env.EXPO_PUBLIC_API_URL,
  extra.EXPO_PUBLIC_API_URL,
  `http://${DEFAULT_HOST}`,
);
const configuredWs = configuredValue(
  process.env.EXPO_PUBLIC_WS_URL,
  extra.EXPO_PUBLIC_WS_URL,
  configuredApi.replace(/^http/, 'ws') + '/ws',
);

export const API_URL = normalizeBaseUrl(configuredApi);
export const WS_URL = configuredWs;
export const DEVICE_ID = configuredValue(
  process.env.EXPO_PUBLIC_DEVICE_ID,
  extra.EXPO_PUBLIC_DEVICE_ID,
  'esp-05',
);
export const GROUP_NAME = configuredValue(
  process.env.EXPO_PUBLIC_GROUP_NAME,
  extra.EXPO_PUBLIC_GROUP_NAME,
  'groupe5',
);
export const APP_NAME = configuredValue(
  process.env.EXPO_PUBLIC_APP_NAME,
  extra.EXPO_PUBLIC_APP_NAME,
  'Petit Nid',
);
export const SENTRY_DSN = configuredValue(
  process.env.EXPO_PUBLIC_SENTRY_DSN,
  extra.EXPO_PUBLIC_SENTRY_DSN,
  '',
);

export const DEFAULT_THRESHOLDS = {
  tMin: 18,
  tMax: 26,
  hMin: 35,
  hMax: 70,
  holdSeconds: 60,
} as const;

// Alerts older than this still update the UI on resync, but no longer
// trigger the automatic night-light command.
export const ALERT_AUTOMATION_RECENCY_SECONDS = 15 * 60;

export function defaultThresholdForm() {
  return {
    tMin: String(DEFAULT_THRESHOLDS.tMin),
    tMax: String(DEFAULT_THRESHOLDS.tMax),
    hMin: String(DEFAULT_THRESHOLDS.hMin ?? ''),
    hMax: String(DEFAULT_THRESHOLDS.hMax ?? ''),
    holdSeconds: String(DEFAULT_THRESHOLDS.holdSeconds),
  };
}
