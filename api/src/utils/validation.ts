import { z } from "zod";

export const sensorDataSchema = z.object({
  ts: z.number(),
  t: z.number(),
  h: z.number(),
  seq: z.number().optional(),
});

const humidityBound = z.number().min(0).max(100).nullable();

// Mirrors the mobile app's form validation (utils/thresholds.ts): the API is
// the enforcement point, so it must reject what the app would reject.
export const thresholdsSchema = z
  .object({
    tMin: z.number(),
    tMax: z.number(),
    hMin: humidityBound,
    hMax: humidityBound,
    holdSeconds: z.number().int().min(1).max(7200),
  })
  .refine((t) => t.tMin < t.tMax, {
    message: "tMin must be lower than tMax",
    path: ["tMin"],
  })
  .refine((t) => t.hMin === null || t.hMax === null || t.hMin < t.hMax, {
    message: "hMin must be lower than hMax",
    path: ["hMin"],
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
