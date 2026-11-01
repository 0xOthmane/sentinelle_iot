import { createContext, type Dispatch, type SetStateAction } from 'react';
import type {
  AlertEvent,
  HistoryRange,
  HistoryStats,
  JournalItem,
  Measurement,
  ThresholdForm,
  Thresholds,
} from '@/types';

export type SentinelleContextValue = {
  historyMeasurements: Measurement[];
  historyStats: HistoryStats | null;
  deviceStatus: 'online' | 'offline';
  backendOnline: boolean;
  networkConnected: boolean;
  ledOn: boolean;
  ledPending: boolean;
  historyLoading: boolean;
  thresholdLoading: boolean;
  historyRange: HistoryRange;
  setHistoryRange: (range: HistoryRange) => void;
  thresholds: Thresholds;
  thresholdForm: ThresholdForm;
  setThresholdForm: Dispatch<SetStateAction<ThresholdForm>>;
  thresholdDirty: boolean;
  activeAlert: AlertEvent | null;
  notificationsEnabled: boolean;
  journalItems: JournalItem[];
  toggleLed: () => Promise<void>;
  saveThresholdSettings: () => Promise<void>;
  toggleNotifications: (enabled: boolean) => Promise<void>;
  refreshJournal: () => Promise<void>;
};

// Updated on every WebSocket measurement frame: kept in its own context so
// screens that don't read live data aren't re-rendered at the sensor rate.
export type SentinelleLiveValue = {
  temperature: number | null;
  humidity: number | null;
  liveMeasurements: Measurement[];
  lastMeasurement: Measurement | null;
  liveLoading: boolean;
};

export const SentinelleContext =
  createContext<SentinelleContextValue | null>(null);

export const SentinelleLiveContext =
  createContext<SentinelleLiveValue | null>(null);
