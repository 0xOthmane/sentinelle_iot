import * as SecureStore from 'expo-secure-store';

const JWT_KEY = 'sentinelle_jwt';

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(JWT_KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(JWT_KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(JWT_KEY);
  } catch {
    // Missing key or store failure: token is already effectively gone.
  }
}
