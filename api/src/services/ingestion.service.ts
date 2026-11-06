import { DevicesRepo } from "../db/repositories/devices.repo";
import { MeasurementsRepo } from "../db/repositories/measurements.repo";
import { EventsRepo } from "../db/repositories/events.repo";
import { AlertService } from "./alert.service";
import { wsManager } from "../ws/manager";
import type { MqttDataPayload } from "../types";

// A sensor without NTP sends ts≈0 or seconds-since-boot: such readings would
// be invisible to time-range queries and break the alert hold window.
const MAX_CLOCK_SKEW_SECONDS = 24 * 60 * 60;

export class IngestionService {
  private devicesRepo = new DevicesRepo();
  private measurementsRepo = new MeasurementsRepo();
  private eventsRepo = new EventsRepo();
  private alertService = new AlertService();

  /**
   * Handle sentinelle/<group>/<id>/telemetry
   */
  processTelemetry(data: MqttDataPayload): void {
    const now = Math.floor(Date.now() / 1000);

    let ts = data.ts;
    if (Math.abs(ts - now) > MAX_CLOCK_SKEW_SECONDS) {
      console.warn(
        `[INGEST] ${data.id}: device ts=${ts} is >24h off server time, using receive time`,
      );
      ts = now;
    }

    const previous = this.devicesRepo.findById(data.id);

    this.devicesRepo.upsert({
      id: data.id,
      group: data.group,
      status: "online",
      lastSeen: now,
    });

    // The offline sweeper announces "offline"; announce the way back too,
    // otherwise clients keep showing the sensor as offline.
    if (previous && previous.status !== "online") {
      this.announceStatus(data.id, "online", now);
    }

    this.measurementsRepo.insert({
      device: data.id,
      ts,
      t: data.t,
      h: data.h,
      seq: data.seq ?? null,
      receivedAt: now,
    });

    wsManager.broadcast("measurement", {
      device: data.id,
      ts,
      t: data.t,
      h: data.h,
    });

    this.alertService.evaluate(data.id, ts, data.t, data.h);
  }

  processStatus(
    deviceId: string,
    group: string,
    status: "online" | "offline",
  ): void {
    const now = Math.floor(Date.now() / 1000);

    this.devicesRepo.upsert({
      id: deviceId,
      group,
      status,
      lastSeen: now,
    });

    this.announceStatus(deviceId, status, now);

    console.log(
      `[STATUS] Device ${deviceId} (${group}) reported status: ${status}`,
    );
  }

  private announceStatus(
    deviceId: string,
    status: "online" | "offline",
    now: number,
  ): void {
    const statusData = { device: deviceId, status };
    wsManager.broadcast("device_status", statusData);
    this.eventsRepo.insert({
      device: deviceId,
      ts: now,
      type: "device_status",
      content: JSON.stringify(statusData),
    });
  }
}
