export type Measurement = { ts: number; t: number; h: number };

export type Device = {
  id: string;
  group: string;
  status: 'online' | 'offline';
  lastSeen?: number;
};

export type Thresholds = {
  tMin: number;
  tMax: number;
  hMin: number | null;
  hMax: number | null;
  holdMinutes: number;
};

export type ThresholdForm = {
  tMin: string;
  tMax: string;
  hMin: string;
  hMax: string;
  holdMinutes: string;
};

export type HistoryRange = '1h' | '24h' | '7d';

export type AlertEvent = {
  kind: string;
  value?: number;
  threshold?: number;
  ts?: number;
};

export type JournalItem = {
  id: string;
  type: string;
  message: string;
  createdAt: number;
};

export type RoomState =
  | { kind: 'alert'; title: string; text: string }
  | { kind: 'warning'; title: string; text: string }
  | { kind: 'neutral'; title: string; text: string }
  | { kind: 'good'; title: string; text: string };

export type HistoryStats = {
  tMin: number;
  tAvg: number;
  tMax: number;
  hMin: number;
  hAvg: number;
  hMax: number;
};
