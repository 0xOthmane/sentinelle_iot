import * as SecureStore from 'expo-secure-store';

const JWT_KEY = 'sentinelle_jwt';

let cached: string | null | undefined;
let inflight: Promise<string | null> | null = null;

export async function getToken(): Promise<string | null> {
  if (cached !== undefined) return cached;

  inflight ??= (async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_KEY);
      cached = token;
      return token;
    } catch {
      // Do not cache transient read failures; allow the next call to retry.
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(JWT_KEY, token);
  cached = token;
}

export async function clearToken(): Promise<void> {
  cached = null;
  try {
    await SecureStore.deleteItemAsync(JWT_KEY);
  } catch {
    // Missing key or store failure: token is already effectively gone.
  }
}