import { z } from 'zod';

import type { AlertEvent } from './api';

const measurementFrameSchema = z.object({
  type: z.literal('measurement'),
  device: z.string(),
  ts: z.number().int(),
  t: z.number().nullable(),
  h: z.number().nullable(),
});

const deviceStatusFrameSchema = z.object({
  type: z.literal('device_status'),
  device: z.string(),
  status: z.enum(['online', 'offline']),
});

const alertFrameSchema = z.object({
  type: z.literal('alert'),
  device: z.string(),
  ts: z.number().int().optional(),
  kind: z.string(),
  value: z.number().nullish(),
  threshold: z.number().nullish(),
});

const alertClearedFrameSchema = z.object({
  type: z.literal('alert_cleared'),
  device: z.string(),
  ts: z.number().int().optional(),
  kind: z.string(),
});

export const snapshotAlertSchema = z.object({
  device: z.string(),
  kind: z.string(),
  value: z.number().nullish(),
  threshold: z.number().nullish(),
  ts: z.number().int().optional(),
});

export type SnapshotAlert = z.infer<typeof snapshotAlertSchema>;

const snapshotFrameSchema = z.object({
  type: z.literal('snapshot'),
  alerts: z.array(snapshotAlertSchema),
  ts: z.number().int().optional(),
});

export const liveFrameSchema = z.discriminatedUnion('type', [
  measurementFrameSchema,
  deviceStatusFrameSchema,
  alertFrameSchema,
  alertClearedFrameSchema,
  snapshotFrameSchema,
]);

export type LiveFrame = z.infer<typeof liveFrameSchema>;

export function toAlertEvent(alert: SnapshotAlert | AlertEvent): AlertEvent {
  return {
    kind: alert.kind,
    value: alert.value,
    threshold: alert.threshold,
    ts: alert.ts,
  };
}
