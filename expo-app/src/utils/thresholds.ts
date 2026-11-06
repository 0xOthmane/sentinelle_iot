import type { ThresholdForm, Thresholds } from '@/types';

export type ThresholdParseError = { title: string; message: string };

export function parseThresholdForm(
  form: ThresholdForm,
): { value: Thresholds } | { error: ThresholdParseError } {
  const toNumber = (raw: string) => Number(raw.replace(',', '.'));

  const tMin = toNumber(form.tMin);
  const tMax = toNumber(form.tMax);
  const hMin =
    form.hMin.trim() === '' ? null : toNumber(form.hMin);
  const hMax =
    form.hMax.trim() === '' ? null : toNumber(form.hMax);
  const holdSeconds = toNumber(form.holdSeconds);

  if (
    !Number.isFinite(tMin) ||
    !Number.isFinite(tMax) ||
    tMin >= tMax ||
    !Number.isFinite(holdSeconds) ||
    !Number.isInteger(holdSeconds) ||
    holdSeconds < 1 ||
    holdSeconds > 7200
  ) {
    return {
      error: {
        title: 'Seuils invalides',
        message:
          'Température : min < max. Durée : entre 1 et 7200 secondes.',
      },
    };
  }

  if (
    (hMin != null && (hMin < 0 || hMin > 100)) ||
    (hMax != null && (hMax < 0 || hMax > 100)) ||
    (hMin != null && hMax != null && hMin >= hMax)
  ) {
    return {
      error: {
        title: 'Humidité invalide',
        message:
          'Les seuils d’humidité doivent être compris entre 0 et 100 %, avec min < max.',
      },
    };
  }

  return {
    value: {
      tMin,
      tMax,
      hMin,
      hMax,
      holdSeconds,
    },
  };
}

export function thresholdsToForm(value: Thresholds): ThresholdForm {
  return {
    tMin: String(value.tMin),
    tMax: String(value.tMax),
    hMin: value.hMin == null ? '' : String(value.hMin),
    hMax: value.hMax == null ? '' : String(value.hMax),
    holdSeconds: String(value.holdSeconds),
  };
}
