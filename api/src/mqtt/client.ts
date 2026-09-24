import mqtt, { type MqttClient } from "mqtt";
import { CONFIG } from "../config";
import { handleMqttMessage } from "./handlers";

let client: MqttClient;

export function connectMqtt(): MqttClient {
  client = mqtt.connect(CONFIG.MQTT_BROKER_URL, {
    username: CONFIG.MQTT_USERNAME,
    password: CONFIG.MQTT_PASSWORD,
    protocolVersion: 5,
    clean: true,
    reconnectPeriod: 5000,
  });

  client.on("connect", () => {
    console.log("[MQTT] Connected to HiveMQ");

    client.subscribe(
      CONFIG.MQTT_TOPICS_SUBSCRIBE as unknown as string[],
      { qos: 1 },
      (err) => {
        if (err) {
          console.error("[MQTT] Subscription error:", err);
        } else {
          console.log(`[MQTT] Subscribed to:`, CONFIG.MQTT_TOPICS_SUBSCRIBE);
        }
      },
    );
  });

  client.on("message", (topic, payload) => {
    try {
      handleMqttMessage(topic, payload);
    } catch (err) {
      console.error("[MQTT] Message handling error:", err);
    }
  });

  client.on("error", (err) => {
    console.error("[MQTT] Error:", err);
  });

  client.on("reconnect", () => {
    console.log("[MQTT] Reconnecting...");
  });

  client.on("close", () => {
    console.log("[MQTT] Connection closed");
  });

  return client;
}

export function getMqttClient(): MqttClient {
  return client;
}
