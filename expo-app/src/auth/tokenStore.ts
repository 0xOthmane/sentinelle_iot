import * as SecureStore from 'expo-secure-store';

const JWT_KEY = 'sentinelle_jwt';

// authedFetch reads the token on every REST call and the connect path reads
// it once more: on Android these SecureStore reads serialize slowly, and a
// burst (refreshAll fires five) can stall the WS connect behind them. Cache
// in memory after the first read so later callers never touch the store.
let cached: string | null | undefined;
let inflight: Promise<string | null> | null;

export async function getToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  // Deduplicate concurrent cold reads into one store access.
  inflight ??= SecureStore.getItemAsync(JWT_KEY)
    .then((token) => {
      cached = token;
      return token;
    })
    .catch(() => {
      cached = null;
      return null;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function saveToken(token: string): Promise<void> {
  cached = token;
  await SecureStore.setItemAsync(JWT_KEY, token);
}

export async function clearToken(): Promise<void> {
  cached = null;
  try {
    await SecureStore.deleteItemAsync(JWT_KEY);
  } catch {
    // Missing key or store failure: token is already effectively gone.
  }
}
