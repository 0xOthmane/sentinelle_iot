import { z } from 'zod';

import type { ThresholdForm, Thresholds } from '@/types';

const numberString = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value !== '' && Number.isFinite(Number(value)), {
      message: `${label} doit être un nombre.`,
    });

const optionalNumberString = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || Number.isFinite(Number(value)), {
      message: `${label} doit être un nombre.`,
    });

export const thresholdFormSchema = z
  .object({
    tMin: numberString('Le minimum de température'),
    tMax: numberString('Le maximum de température'),
    hMin: optionalNumberString('Le minimum d’humidité'),
    hMax: optionalNumberString('Le maximum d’humidité'),
    holdSeconds: z
      .string()
      .trim()
      .regex(/^\d+$/, 'Le délai doit être un nombre entier.'),
  })
  .superRefine((form, ctx) => {
    const tMin = Number(form.tMin);
    const tMax = Number(form.tMax);

    if (tMin >= tMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tMax'],
        message: 'Le maximum doit être supérieur au minimum.',
      });
    }

    const hMin = form.hMin.trim() === '' ? null : Number(form.hMin);
    const hMax = form.hMax.trim() === '' ? null : Number(form.hMax);

    if (hMin !== null && (hMin < 0 || hMin > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hMin'],
        message: 'L’humidité doit être entre 0 et 100.',
      });
    }
    if (hMax !== null && (hMax < 0 || hMax > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hMax'],
        message: 'L’humidité doit être entre 0 et 100.',
      });
    }
    if (hMin !== null && hMax !== null && hMin >= hMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hMax'],
        message: 'Le maximum doit être supérieur au minimum.',
      });
    }

    const holdSeconds = Number(form.holdSeconds);
    if (holdSeconds < 1 || holdSeconds > 7200) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['holdSeconds'],
        message: 'Le délai doit être entre 1 et 7200 secondes.',
      });
    }
  });

export function thresholdsToForm(value: Thresholds): ThresholdForm {
  return {
    tMin: String(value.tMin),
    tMax: String(value.tMax),
    hMin: value.hMin === null ? '' : String(value.hMin),
    hMax: value.hMax === null ? '' : String(value.hMax),
    holdSeconds: String(value.holdSeconds),
  };
}

export function formToThresholds(form: ThresholdForm): Thresholds {
  return {
    tMin: Number(form.tMin),
    tMax: Number(form.tMax),
    hMin: form.hMin.trim() === '' ? null : Number(form.hMin),
    hMax: form.hMax.trim() === '' ? null : Number(form.hMax),
    holdSeconds: Number(form.holdSeconds),
  };
}
