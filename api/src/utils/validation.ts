import { z } from "zod";

export const sensorDataSchema = z.object({
  ts: z.number(),
  t: z.number(),
  h: z.number(),
  seq: z.number().optional(),
});

export const thresholdsSchema = z.object({
  tMin: z.number().nullable(),
  tMax: z.number().nullable(),
  hMin: z.number().nullable(),
  hMax: z.number().nullable(),
  holdMinutes: z.number().int().min(1),
});

export const commandSchema = z
  .object({
    led: z.boolean().optional(),
  })
  .catchall(z.unknown());

export const measurementsQuerySchema = z.object({
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  step: z.coerce.number().int().positive().optional(),
});
