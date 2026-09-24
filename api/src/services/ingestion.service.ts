import { DevicesRepo } from "../db/repositories/devices.repo";
import { MeasurementsRepo } from "../db/repositories/measurements.repo";
import { EventsRepo } from "../db/repositories/events.repo";
import { AlertService } from "./alert.service";
import { wsManager } from "../ws/manager";
import type { MqttDataPayload } from "../types";

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

    this.devicesRepo.upsert({
      id: data.id,
      group: data.group,
      status: "online",
      lastSeen: now,
    });

    this.measurementsRepo.insert({
      device: data.id,
      ts: data.ts,
      t: data.t,
      h: data.h,
      seq: data.seq ?? null,
      receivedAt: now,
    });

    wsManager.broadcast("measurement", {
      device: data.id,
      ts: data.ts,
      t: data.t,
      h: data.h,
    });

    this.alertService.evaluate(data.id, data.ts, data.t, data.h);
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

    const statusData = {
      device: deviceId,
      status,
    };
    wsManager.broadcast("device_status", statusData);

    this.eventsRepo.insert({
      device: deviceId,
      ts: now,
      type: "device_status",
      content: JSON.stringify(statusData),
    });

    console.log(
      `[STATUS] Device ${deviceId} (${group}) reported status: ${status}`,
    );
  }
}
