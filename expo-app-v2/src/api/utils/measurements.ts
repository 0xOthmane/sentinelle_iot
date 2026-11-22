import * as Sentry from '@sentry/react-native';

import type { Measurement, MeasurementResponse } from '@/types';
import { measurementListSchema } from '@/types';
import { getJson } from './http';

export function isCompleteMeasurement(
  measurement: MeasurementResponse,
): measurement is Measurement {
  return Number.isFinite(measurement.t) && Number.isFinite(measurement.h);
}

export async function getMeasurements(
  url: string,
  init?: RequestInit,
): Promise<Measurement[]> {
  const measurements = await getJson(url, measurementListSchema, init);
  const complete = measurements.filter(isCompleteMeasurement);
  if (complete.length < measurements.length) {
    Sentry.logger.warn('Incomplete measurements ignored', {
      ignored: measurements.length - complete.length,
      total: measurements.length,
      url,
    });
  }
  return complete;
}