import { useContext } from 'react';
import {
  SentinelleContext,
  type SentinelleContextValue,
} from '@/state/SentinelleContext';

export function useSentinelle(): SentinelleContextValue {
  const value = useContext(SentinelleContext);
  if (!value) throw new Error('useSentinelle must be used inside provider');
  return value;
}
