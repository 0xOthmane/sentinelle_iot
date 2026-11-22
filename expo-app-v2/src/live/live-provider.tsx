import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/auth/auth-store';
import { useLiveStore } from '@/stores/live-store';
import { startLiveConnection, stopLiveConnection } from './connection';
import { resetLedController } from './led-controller';

export function LiveProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const isReady = useAuthStore((state) => state.isReady);
  const reset = useLiveStore((state) => state.reset);

  useEffect(() => {
    if (!isReady) return;

    if (!token) {
      stopLiveConnection();
      resetLedController();
      reset();
      return;
    }

    // Hydration can finish while the app is backgrounded; wait for the
    // foreground event instead of opening a socket nobody can see.
    if (AppState.currentState !== 'background') {
      startLiveConnection();
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startLiveConnection();
      } else if (state === 'background') {
        stopLiveConnection();
      }
    });

    return () => {
      subscription.remove();
      stopLiveConnection();
    };
  }, [isReady, reset, token]);

  return children;
}
