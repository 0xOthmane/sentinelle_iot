import { useCallback, useRef, useState, type RefObject } from 'react';

export type ConnectionState = {
  networkConnected: boolean;
  backendOnline: boolean;
  // Refs mirror the state for async callbacks that outlive a render.
  networkRef: RefObject<boolean>;
  backendRef: RefObject<boolean>;
  setNetwork: (connected: boolean) => void;
  setBackend: (online: boolean) => void;
};

export function useConnectionState(): ConnectionState {
  const [networkConnected, setNetworkConnected] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const networkRef = useRef(true);
  const backendRef = useRef(false);

  const setNetwork = useCallback((connected: boolean) => {
    networkRef.current = connected;
    setNetworkConnected(connected);
  }, []);

  const setBackend = useCallback((online: boolean) => {
    backendRef.current = online;
    setBackendOnline(online);
  }, []);

  return {
    networkConnected,
    backendOnline,
    networkRef,
    backendRef,
    setNetwork,
    setBackend,
  };
}
