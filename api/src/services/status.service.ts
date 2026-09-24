import { DevicesRepo } from "../db/repositories/devices.repo";
import { EventsRepo } from "../db/repositories/events.repo";
import { wsManager } from "../ws/manager";
import { CONFIG } from "../config";

export class StatusService {
  private devicesRepo = new DevicesRepo();
  private eventsRepo = new EventsRepo();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.intervalHandle = setInterval(() => {
      this.checkOffline();
    }, 30_000);

    console.log("[STATUS] Offline detection started (30s interval)");
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private checkOffline(): void {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - CONFIG.DEVICE_OFFLINE_TIMEOUT_SECONDS;

    const onlineDevices = this.devicesRepo.findOnlineDevices();

    for (const device of onlineDevices) {
      if (device.lastSeen < cutoff) {
        this.devicesRepo.updateStatus(device.id, "offline", device.lastSeen);

        const statusData = {
          device: device.id,
          status: "offline",
        };

        wsManager.broadcast("device_status", statusData);

        this.eventsRepo.insert({
          device: device.id,
          ts: now,
          type: "device_status",
          content: JSON.stringify(statusData),
        });

        console.log(`[STATUS] Device ${device.id} → offline`);
      }
    }
  }
}
