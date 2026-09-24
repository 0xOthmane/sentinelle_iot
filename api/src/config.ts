import "dotenv/config";

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "3000"),

  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL!,
  MQTT_USERNAME: process.env.MQTT_USERNAME!,
  MQTT_PASSWORD: process.env.MQTT_PASSWORD!,
  MQTT_TOPIC_DATA: "sentinelle/+/+/data",
  MQTT_TOPIC_CMD_PREFIX: "sentinelle",

  DB_PATH: process.env.DB_PATH || "./sentinelle.db",

  DEFAULT_LOOKBACK_SECONDS: 600,
  DEVICE_OFFLINE_TIMEOUT_SECONDS: 120,
} as const;
