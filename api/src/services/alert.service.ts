import { ThresholdsRepo } from "../db/repositories/thresholds.repo";
import { EventsRepo } from "../db/repositories/events.repo";
import { AlertStatesRepo } from "../db/repositories/alertStates.repo";
import { wsManager } from "../ws/manager";

type ThresholdKind = "tMin" | "tMax" | "hMin" | "hMax";

export class AlertService {
  private thresholdsRepo = new ThresholdsRepo();
  private eventsRepo = new EventsRepo();
  private alertStatesRepo = new AlertStatesRepo();

  /** Active (already fired, not yet cleared) alerts for one device. */
  getActiveAlerts(device: string): Array<{
    device: string;
    kind: string;
    value: number | null;
    threshold: number | null;
    ts: number;
  }> {
    return this.alertStatesRepo.getActive(device).map((s) => ({
      device: s.device,
      kind: s.kind,
      value: s.value,
      threshold: s.threshold,
      ts: s.updatedTs,
    }));
  }

  /** All active alerts across devices (used for WS snapshots). */
  getAllActiveAlerts(): Array<{
    device: string;
    kind: string;
    value: number | null;
    threshold: number | null;
    ts: number;
  }> {
    return this.alertStatesRepo.getAllActive().map((s) => ({
      device: s.device,
      kind: s.kind,
      value: s.value,
      threshold: s.threshold,
      ts: s.updatedTs,
    }));
  }

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
        const existing = this.alertStatesRepo.get(device, check.kind);

        if (!existing) {
          // Start tracking this violation (durable: survives API restart)
          this.alertStatesRepo.upsert({
            device,
            kind: check.kind,
            firstViolationTs: ts,
            alerted: false,
            value: check.value,
            threshold: check.threshold,
            updatedTs: ts,
          });
          console.log(
            `[ALERT] ${key}: violation started (value=${check.value}, threshold=${check.threshold})`,
          );
        } else {
          // Device clock may reset/replay old buffered points: never let
          // firstViolationTs sit in the future or the hold never elapses.
          const firstViolationTs =
            ts < existing.firstViolationTs ? ts : existing.firstViolationTs;
          if (ts < existing.firstViolationTs) {
            this.alertStatesRepo.upsert({
              device,
              kind: check.kind,
              firstViolationTs: ts,
              alerted: existing.alerted,
              value: check.value,
              threshold: check.threshold,
              updatedTs: ts,
            });
          }

          if (
            !existing.alerted &&
            ts - firstViolationTs >= holdSeconds
          ) {
            // Hold time exceeded → fire alert
            this.alertStatesRepo.upsert({
              device,
              kind: check.kind,
              firstViolationTs,
              alerted: true,
              value: check.value,
              threshold: check.threshold,
              updatedTs: ts,
            });

            const alertData = {
              device,
              ts,
              kind: check.kind,
              value: check.value,
              threshold: check.threshold,
            };

            console.log(`[ALERT] FIRING: ${key}`, alertData);

            const result = wsManager.broadcast("alert", alertData);
            if (result.delivered === 0) {
              console.warn(
                `[ALERT] FIRING with no WS clients connected: ${key}. Clients can resync via snapshot / GET active alerts.`,
              );
            }

            this.eventsRepo.insert({
              device,
              ts,
              type: "alert",
              content: JSON.stringify(alertData),
            });
          } else if (!existing.alerted) {
            // Still in hold window: refresh latest value for snapshot accuracy.
            this.alertStatesRepo.upsert({
              device,
              kind: check.kind,
              firstViolationTs,
              alerted: false,
              value: check.value,
              threshold: check.threshold,
              updatedTs: ts,
            });
          }
        }
      } else {
        // No violation → clear if was previously tracked
        const existing = this.alertStatesRepo.get(device, check.kind);

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

        if (existing) {
          this.alertStatesRepo.delete(device, check.kind);
        }
      }
    }
  }
}
