import { MeasurementsRepo } from "../db/repositories/measurements.repo";
import { CONFIG } from "../config";
import type { Measurement } from "../types";

export class AggregationService {
  private repo = new MeasurementsRepo();

  getMeasurements(
    device: string,
    from?: number,
    to?: number,
    step?: number,
  ): Measurement[] {
    const now = Math.floor(Date.now() / 1000);
    const effectiveTo = to ?? now;
    const effectiveFrom = from ?? now - CONFIG.DEFAULT_LOOKBACK_SECONDS;

    if (step && step > 0) {
      return this.repo.findAggregated(device, effectiveFrom, effectiveTo, step);
    }

    return this.repo.findRaw(device, effectiveFrom, effectiveTo);
  }
}
