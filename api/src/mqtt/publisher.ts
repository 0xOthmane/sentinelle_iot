import { getMqttClient } from "./client";
import { CONFIG } from "../config";

export function publishCommand(
  group: string,
  deviceId: string,
  payload: Record<string, unknown>,
): boolean {
  const client = getMqttClient();

  if (!client || !client.connected) {
    console.error("[MQTT] Cannot publish: client not connected");
    return false;
  }

  const topic = `${CONFIG.MQTT_TOPIC_CMD_PREFIX}/${group}/${deviceId}/cmd`;
  const message = JSON.stringify(payload);

  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) {
      console.error(`[MQTT] Publish error to ${topic}:`, err);
    } else {
      console.log(`[MQTT] Published to ${topic}: ${message}`);
    }
  });

  return true;
}
