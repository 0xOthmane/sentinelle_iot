import Constants from 'expo-constants';

const extra =
  (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

function env(name: string, fallback: string): string {
  return process.env[name] ?? extra[name] ?? fallback;
}

const DEFAULT_HOST = '172.20.10.4:3000';

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '');
}

const configuredApi = env('EXPO_PUBLIC_API_URL', `http://${DEFAULT_HOST}`);
const configuredWs = env(
  'EXPO_PUBLIC_WS_URL',
  configuredApi.replace(/^http/, 'ws') + '/ws',
);

export const API_URL = normalizeBaseUrl(configuredApi);
export const WS_URL = configuredWs;
export const DEVICE_ID = env('EXPO_PUBLIC_DEVICE_ID', 'esp05');
export const GROUP_NAME = env('EXPO_PUBLIC_GROUP_NAME', 'groupe5');
export const APP_NAME = env('EXPO_PUBLIC_APP_NAME', 'Petit Nid');

export const DEFAULT_THRESHOLDS = {
  tMin: 18,
  tMax: 26,
  hMin: 35,
  hMax: 70,
  holdMinutes: 1,
} as const;

export function defaultThresholdForm() {
  return {
    tMin: String(DEFAULT_THRESHOLDS.tMin),
    tMax: String(DEFAULT_THRESHOLDS.tMax),
    hMin: String(DEFAULT_THRESHOLDS.hMin ?? ''),
    hMax: String(DEFAULT_THRESHOLDS.hMax ?? ''),
    holdMinutes: String(DEFAULT_THRESHOLDS.holdMinutes),
  };
}
