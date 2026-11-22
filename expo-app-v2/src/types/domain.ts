export type ThresholdForm = {
  tMin: string;
  tMax: string;
  hMin: string;
  hMax: string;
  holdSeconds: string;
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