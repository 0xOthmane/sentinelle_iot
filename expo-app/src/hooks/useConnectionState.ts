import { useCallback, useRef, useState, type RefObject } from 'react';

export type ConnectionState = {
  networkConnected: boolean;
  backendOnline: boolean;
  // Refs mirror the state for async callbacks that outlive a render.
  networkRef: RefObject<boolean>;
  backendRef: RefObject<boolean>;
  setNetwork: (connected: boolean) => void;
  setBackend: (online: boolean) => void;
  /** Human-readable socket lifecycle, shown in the Settings debug card. */
  wsStatus: string;
  /** Epoch ms of the last wsStatus change: exposes hangs in the UI. */
  wsStatusSince: number;
  setWsStatus: (status: string) => void;
};

export function useConnectionState(): ConnectionState {
  const [networkConnected, setNetworkConnected] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [wsStatus, setWsStatusRaw] = useState('idle');
  const [wsStatusSince, setWsStatusSince] = useState(() => Date.now());
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

  const setWsStatus = useCallback((status: string) => {
    setWsStatusRaw(status);
    setWsStatusSince(Date.now());
  }, []);

  return {
    networkConnected,
    backendOnline,
    networkRef,
    backendRef,
    setNetwork,
    setBackend,
    wsStatus,
    wsStatusSince,
    setWsStatus,
  };
}
