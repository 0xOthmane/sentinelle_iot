import * as Sentry from '@sentry/react-native';
import { create } from 'zustand';

import { clearToken, getToken } from './tokenStore';

type AuthState = {
  token: string | null;
  isReady: boolean;
  hydrate: () => Promise<void>;
  setToken: (token: string) => void;
  signOut: () => Promise<void>;
};

let hydrating: Promise<void> | null = null;

// A SecureStore read can stall (locked keystore, slow keychain); never let that
// trap the app on the loading screen.
const HYDRATE_TIMEOUT_MS = 5_000;

function getTokenWithTimeout(): Promise<string | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      Sentry.logger.warn('Auth hydration timed out', {
        timeoutMs: HYDRATE_TIMEOUT_MS,
      });
      resolve(null);
    }, HYDRATE_TIMEOUT_MS);
  });

  return Promise.race([getToken(), timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  token: null,
  isReady: false,

  hydrate: () => {
    if (get().isReady) return Promise.resolve();

    hydrating ??= (async () => {
      try {
        const token = await getTokenWithTimeout();
        set({ token });
      } catch (error) {
        Sentry.captureException(error, {
          tags: { feature: 'auth', operation: 'hydrate' },
        });
      } finally {
        set({ isReady: true });
        hydrating = null;
      }
    })();

    return hydrating;
  },

  setToken: (token) => set({ token }),

  signOut: async () => {
    set({ token: null });
    try {
      await clearToken();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'auth', operation: 'sign-out' },
      });
    }
  },
}));
