import type { Buffer } from "node:buffer";
import { IngestionService } from "../services/ingestion.service";

const ingestionService = new IngestionService();

export function handleMqttMessage(topic: string, payload: Buffer): void {
  const parts = topic.split("/");

  // Expected format: sentinelle / <group> / <deviceId> / <channel>
  if (parts.length !== 4 || parts[0] !== "sentinelle") {
    return; 
  }

  const group = parts[1];
  const deviceId = parts[2];
  const channel = parts[3]; // 'telemetry' | 'status'

  const rawString = payload.toString().trim();
  if (!rawString) return;

  switch (channel) {
    case "telemetry": {
      try {
        const data = JSON.parse(rawString);
        if (
          typeof data.ts !== "number" ||
          typeof data.t !== "number" ||
          typeof data.h !== "number"
        ) {
          console.warn(`[MQTT] Invalid telemetry payload from ${topic}`);
          return;
        }

        ingestionService.processTelemetry({
          id: deviceId,
          group,
          ts: data.ts,
          t: data.t,
          h: data.h,
          seq: data.seq ?? null,
        });
      } catch {
        console.error(`[MQTT] JSON parse failed for telemetry on ${topic}`);
      }
      break;
    }

    case "status": {
      // Handles both plain string ("online"/"offline") and JSON ({"status": "online"})
      let statusValue: "online" | "offline" = "online";

      try {
        const parsed = JSON.parse(rawString);
        statusValue = (parsed.status || parsed.state || "online").toLowerCase();
      } catch {
        // Not JSON, treat raw string directly: "online" or "offline"
        statusValue = rawString.toLowerCase() as "online" | "offline";
      }

      if (statusValue !== "online" && statusValue !== "offline") {
        console.warn(`[MQTT] Unknown status '${statusValue}' on ${topic}`);
        return;
      }

      ingestionService.processStatus(deviceId, group, statusValue);
      break;
    }

    default:
      // Ignore other subtopics (e.g. /cmd echo)
      break;
  }
}
