import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/auth/auth-store';
import { createQueryClient } from './query-client';
import { setUnauthorizedHandler } from './utils/http';

export type ApiProviderProps = {
  children: ReactNode;
  onUnauthorized?: () => void;
};

export function ApiProvider({ children, onUnauthorized }: ApiProviderProps) {
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    setUnauthorizedHandler(() => {
      // A 401 means the session is gone: drop the token and let the router
      // guard in `_layout.tsx` redirect to /login.
      void useAuthStore.getState().signOut();
      queryClient.clear();
      onUnauthorized?.();
    });
    return () => setUnauthorizedHandler(null);
  }, [onUnauthorized, queryClient]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}