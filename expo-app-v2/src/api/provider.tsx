import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { clearToken } from '@/auth/tokenStore';
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
      void clearToken();
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