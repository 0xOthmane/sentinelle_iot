import "dotenv/config";

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "3000"),

  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL!,
  MQTT_USERNAME: process.env.MQTT_USERNAME!,
  MQTT_PASSWORD: process.env.MQTT_PASSWORD!,
  MQTT_TOPICS_SUBSCRIBE: ["sentinelle/+/+/telemetry", "sentinelle/+/+/status"],
  MQTT_TOPIC_CMD_PREFIX: "sentinelle",

  DB_PATH: process.env.DB_PATH || "./sentinelle.db",

  DEFAULT_LOOKBACK_SECONDS: 600,
  DEVICE_OFFLINE_TIMEOUT_SECONDS: 120,

  APP_PASSWORD: process.env.APP_PASSWORD || "",
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_EXPIRES_SECONDS: parseInt(
    process.env.JWT_EXPIRES_SECONDS || String(30 * 24 * 60 * 60),
  ),

  WS_TICKET_TTL_SECONDS: parseInt(
    process.env.WS_TICKET_TTL_SECONDS || "30",
  ),

  RATE_LIMIT_LOGIN_WINDOW_MS: parseInt(
    process.env.RATE_LIMIT_LOGIN_WINDOW_MS || String(15 * 60 * 1000),
  ),
  RATE_LIMIT_LOGIN_MAX: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || "5"),
  RATE_LIMIT_API_WINDOW_MS: parseInt(
    process.env.RATE_LIMIT_API_WINDOW_MS || "60000",
  ),
  RATE_LIMIT_API_MAX: parseInt(process.env.RATE_LIMIT_API_MAX || "120"),
} as const;
