import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSentinelleController } from '@/hooks/useSentinelleController';
import { SentinelleContext, SentinelleLiveContext } from './SentinelleContext';

export function SentinelleProvider({ children }: { children: ReactNode }) {
  const { token, isReady } = useAuth();
  const { value, liveValue } = useSentinelleController(token, isReady);

  return (
    <SentinelleContext.Provider value={value}>
      <SentinelleLiveContext.Provider value={liveValue}>
        {children}
      </SentinelleLiveContext.Provider>
    </SentinelleContext.Provider>
  );
}
