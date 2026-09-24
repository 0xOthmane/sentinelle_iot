import { ThresholdsRepo } from "../db/repositories/thresholds.repo";
import { EventsRepo } from "../db/repositories/events.repo";
import { wsManager } from "../ws/manager";

interface ViolationState {
  firstViolationTs: number;
  alerted: boolean;
}

type ThresholdKind = "tMin" | "tMax" | "hMin" | "hMax";

// In-memory map: "device:kind" → ViolationState
const violations = new Map<string, ViolationState>();

export class AlertService {
  private thresholdsRepo = new ThresholdsRepo();
  private eventsRepo = new EventsRepo();

  evaluate(
    device: string,
    ts: number,
    t: number | null,
    h: number | null,
  ): void {
    const thresholds = this.thresholdsRepo.findByDevice(device);
    if (!thresholds) return;

    const checks: Array<{
      kind: ThresholdKind;
      value: number | null;
      threshold: number | null;
      isViolation: boolean;
    }> = [
      {
        kind: "tMin",
        value: t,
        threshold: thresholds.tMin,
        isViolation:
          t !== null && thresholds.tMin !== null && t < thresholds.tMin,
      },
      {
        kind: "tMax",
        value: t,
        threshold: thresholds.tMax,
        isViolation:
          t !== null && thresholds.tMax !== null && t > thresholds.tMax,
      },
      {
        kind: "hMin",
        value: h,
        threshold: thresholds.hMin,
        isViolation:
          h !== null && thresholds.hMin !== null && h < thresholds.hMin,
      },
      {
        kind: "hMax",
        value: h,
        threshold: thresholds.hMax,
        isViolation:
          h !== null && thresholds.hMax !== null && h > thresholds.hMax,
      },
    ];

    const holdSeconds = thresholds.holdMinutes * 60;

    for (const check of checks) {
      const key = `${device}:${check.kind}`;

      if (check.isViolation) {
        const existing = violations.get(key);

        if (!existing) {
          // Start tracking this violation
          violations.set(key, {
            firstViolationTs: ts,
            alerted: false,
          });
          console.log(
            `[ALERT] ${key}: violation started (value=${check.value}, threshold=${check.threshold})`,
          );
        } else if (
          !existing.alerted &&
          ts - existing.firstViolationTs >= holdSeconds
        ) {
          // Hold time exceeded → fire alert
          existing.alerted = true;

          const alertData = {
            device,
            ts,
            kind: check.kind,
            value: check.value,
            threshold: check.threshold,
          };

          console.log(`[ALERT] FIRING: ${key}`, alertData);

          wsManager.broadcast("alert", alertData);

          this.eventsRepo.insert({
            device,
            ts,
            type: "alert",
            content: JSON.stringify(alertData),
          });
        }
      } else {
        // No violation → clear if was previously alerted
        const existing = violations.get(key);

        if (existing?.alerted) {
          const clearedData = { device, ts, kind: check.kind };

          console.log(`[ALERT] CLEARED: ${key}`);

          wsManager.broadcast("alert_cleared", clearedData);

          this.eventsRepo.insert({
            device,
            ts,
            type: "alert_cleared",
            content: JSON.stringify(clearedData),
          });
        }

        violations.delete(key);
      }
    }
  }
}
