import { create } from 'zustand';

import type {
  AlertEvent,
  LiveConnectionState,
  LiveDeviceStatus,
  Measurement,
} from '@/types';

/** Matches the backend's default measurement lookback. */
export const LIVE_WINDOW_SECONDS = 600;

type LiveState = {
  connection: LiveConnectionState;
  deviceStatus: LiveDeviceStatus;
  temperature: number | null;
  humidity: number | null;
  /** Complete measurements only, sorted by timestamp and capped to the window. */
  measurements: Measurement[];
  /** Active alerts keyed by kind so one clear never hides the others. */
  activeAlerts: Record<string, AlertEvent>;
  /** Kinds the user has acknowledged; they no longer drive the LED blink. */
  acknowledgedAlerts: Record<string, boolean>;
  ledOn: boolean;
  ledPending: boolean;
  /** True when the user manually turned the LED on during an active alert. */
  ledManualHold: boolean;
  setLedState: (
    patch: Partial<Pick<LiveState, 'ledOn' | 'ledPending' | 'ledManualHold'>>,
  ) => void;
  acknowledgeAlerts: () => void;
  setConnection: (connection: LiveConnectionState) => void;
  setDeviceStatus: (status: LiveDeviceStatus) => void;
  ingestMeasurement: (measurement: Measurement) => void;
  applyMeasurements: (measurements: readonly Measurement[]) => void;
  ingestAlert: (alert: AlertEvent) => void;
  clearAlert: (kind: string) => void;
  applySnapshot: (alerts: readonly AlertEvent[]) => void;
  reset: () => void;
};

const initialState = {
  connection: 'idle' as LiveConnectionState,
  deviceStatus: 'unknown' as LiveDeviceStatus,
  temperature: null as number | null,
  humidity: null as number | null,
  measurements: [] as Measurement[],
  activeAlerts: {} as Record<string, AlertEvent>,
  acknowledgedAlerts: {} as Record<string, boolean>,
  ledOn: false,
  ledPending: false,
  ledManualHold: false,
};

/**
 * Merge, dedupe and sort measurements, then keep a rolling window anchored to
 * the newest timestamp. Anchoring to the data (rather than `Date.now()`) keeps
 * the window aligned with the chart axis even when the device clock drifts.
 */
function mergeMeasurements(
  existing: readonly Measurement[],
  incoming: readonly Measurement[],
): Measurement[] {
  const byTimestamp = new Map<number, Measurement>();
  for (const measurement of existing) byTimestamp.set(measurement.ts, measurement);
  for (const measurement of incoming) byTimestamp.set(measurement.ts, measurement);

  const sorted = [...byTimestamp.values()].sort((a, b) => a.ts - b.ts);
  const newest = sorted[sorted.length - 1];
  if (!newest) return [];

  const minTs = newest.ts - LIVE_WINDOW_SECONDS;
  return sorted.filter((measurement) => measurement.ts >= minTs);
}

export const useLiveStore = create<LiveState>()((set) => ({
  ...initialState,

  setLedState: (patch) => set(patch),

  acknowledgeAlerts: () =>
    set((state) => {
      const acknowledgedAlerts = { ...state.acknowledgedAlerts };
      for (const kind of Object.keys(state.activeAlerts)) {
        acknowledgedAlerts[kind] = true;
      }
      return { acknowledgedAlerts };
    }),

  setConnection: (connection) => set({ connection }),

  setDeviceStatus: (deviceStatus) => set({ deviceStatus }),

  ingestMeasurement: (measurement) =>
    set((state) => {
      const previousLatest = state.measurements[state.measurements.length - 1];
      const measurements = mergeMeasurements(state.measurements, [measurement]);

      // Replayed/backfilled points must not move the headline values back in
      // time; only a newer (or equal) timestamp updates them.
      if (previousLatest && measurement.ts < previousLatest.ts) {
        return { measurements };
      }

      return {
        measurements,
        temperature: measurement.t,
        humidity: measurement.h,
      };
    }),

  applyMeasurements: (measurements) =>
    set((state) => {
      const merged = mergeMeasurements(state.measurements, measurements);
      const latest = merged[merged.length - 1];

      return latest
        ? { measurements: merged, temperature: latest.t, humidity: latest.h }
        : { measurements: merged };
    }),

  ingestAlert: (alert) =>
    set((state) => ({
      activeAlerts: { ...state.activeAlerts, [alert.kind]: alert },
    })),

  clearAlert: (kind) =>
    set((state) => {
      const activeAlerts = { ...state.activeAlerts };
      delete activeAlerts[kind];

      const acknowledgedAlerts = { ...state.acknowledgedAlerts };
      delete acknowledgedAlerts[kind];

      return { activeAlerts, acknowledgedAlerts };
    }),

  applySnapshot: (alerts) =>
    set((state) => {
      const activeAlerts: Record<string, AlertEvent> = {};
      for (const alert of alerts) activeAlerts[alert.kind] = alert;

      // Acknowledgement survives reconnects for alerts that are still active.
      const acknowledgedAlerts: Record<string, boolean> = {};
      for (const kind of Object.keys(activeAlerts)) {
        if (state.acknowledgedAlerts[kind]) acknowledgedAlerts[kind] = true;
      }

      return { activeAlerts, acknowledgedAlerts };
    }),

  reset: () => set(initialState),
}));
