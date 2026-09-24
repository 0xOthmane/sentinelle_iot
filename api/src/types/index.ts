export interface Device {
  id: string;
  group: string;
  status: "online" | "offline";
  lastSeen: number;
}

export interface Measurement {
  ts: number;
  t: number | null;
  h: number | null;
}

export interface RawMeasurement {
  device: string;
  ts: number;
  t: number | null;
  h: number | null;
  seq: number | null;
  receivedAt: number;
}

export interface Thresholds {
  tMin: number | null;
  tMax: number | null;
  hMin: number | null;
  hMax: number | null;
  holdMinutes: number;
}

export interface MqttDataPayload {
  id: string;
  group: string;
  ts: number;
  t: number;
  h: number;
  seq?: number;
}

export interface CommandPayload {
  led?: boolean;
  [key: string]: unknown;
}
