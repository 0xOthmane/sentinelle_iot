import { z } from 'zod';

export const measurementResponseSchema = z.object({
  ts: z.number(),
  t: z.number().nullable(),
  h: z.number().nullable(),
});

export type MeasurementResponse = z.infer<typeof measurementResponseSchema>;

export type Measurement = {
  ts: number;
  t: number;
  h: number;
};

export const deviceSchema = z.object({
  id: z.string(),
  group: z.string(),
  status: z.enum(['online', 'offline']),
  lastSeen: z.number().optional(),
});

export type Device = z.infer<typeof deviceSchema>;

export const thresholdsResponseSchema = z.object({
  tMin: z.number().nullable(),
  tMax: z.number().nullable(),
  hMin: z.number().nullable(),
  hMax: z.number().nullable(),
  holdSeconds: z.number(),
});

export type ThresholdResponse = z.infer<typeof thresholdsResponseSchema>;

export const thresholdsSchema = z.object({
  tMin: z.number(),
  tMax: z.number(),
  hMin: z.number().nullable(),
  hMax: z.number().nullable(),
  holdSeconds: z.number(),
});

export type Thresholds = z.infer<typeof thresholdsSchema>;

export const alertEventSchema = z.object({
  kind: z.string(),
  value: z.number().optional(),
  threshold: z.number().optional(),
  ts: z.number().optional(),
});

export type AlertEvent = z.infer<typeof alertEventSchema>;

export const historyRangeSchema = z.enum(['1h', '24h', '7d']);
export type HistoryRange = z.infer<typeof historyRangeSchema>;

export const loginResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.number(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const wsTicketSchema = z.object({
  ticket: z.string(),
  expiresIn: z.number(),
});
export type WsTicket = z.infer<typeof wsTicketSchema>;

export const commandResponseSchema = z
  .object({ sent: z.boolean().optional() })
  .nullable();
export type CommandResponse = z.infer<typeof commandResponseSchema>;

export type Command = {
  id: string;
  led: boolean;
};

export type FetchThresholdsResult = {
  value: Thresholds;
  configured: boolean;
};

export const measurementListSchema = z.array(measurementResponseSchema);
export const deviceListSchema = z.array(deviceSchema);
export const alertListSchema = z.array(alertEventSchema);