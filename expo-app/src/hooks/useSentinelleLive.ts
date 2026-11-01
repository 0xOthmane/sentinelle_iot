import { useContext } from 'react';
import {
  SentinelleLiveContext,
  type SentinelleLiveValue,
} from '@/state/SentinelleContext';

/** Live sensor data; re-renders the caller on every measurement frame. */
export function useSentinelleLive(): SentinelleLiveValue {
  const value = useContext(SentinelleLiveContext);
  if (!value) throw new Error('useSentinelleLive must be used inside provider');
  return value;
}
