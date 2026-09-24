import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

import { CONFIG } from "./config.js";
import { getDb, closeDb } from "./db/connection.js";
import { connectMqtt } from "./mqtt/client.js";
import { setupWebSocket } from "./ws/upgrade.js";
import { StatusService } from "./services/status.service.js";

// Routes
import { devicesRoute } from "./routes/devices.route.js";
import { measurementsRoute } from "./routes/measurements.route.js";
import { thresholdsRoute } from "./routes/thresholds.route.js";
import { commandsRoute } from "./routes/commands.route.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Math.floor(Date.now() / 1000),
  });
});

app.route("/devices", devicesRoute);
app.route("/devices", measurementsRoute);
app.route("/devices", thresholdsRoute);
app.route("/devices", commandsRoute);

const { injectWebSocket } = setupWebSocket(app);


function boot(): void {
  console.log("═══════════════════════════════════════");
  console.log("  Sentinelle API — Starting...");
  console.log("═══════════════════════════════════════");

  getDb();
  console.log("[DB] SQLite initialized");

  connectMqtt();

  const statusService = new StatusService();
  statusService.start();

  const server = serve(
    {
      fetch: app.fetch,
      port: CONFIG.PORT,
    },
    (info) => {
      console.log("───────────────────────────────────────");
      console.log(`  HTTP  → http://localhost:${info.port}`);
      console.log(`  WS    → ws://localhost:${info.port}/ws`);
      console.log("───────────────────────────────────────");
    },
  );

  injectWebSocket(server);

  const shutdown = (): void => {
    console.log("\n[SHUTDOWN] Graceful shutdown initiated...");
    statusService.stop();
    closeDb();
    console.log("[SHUTDOWN] Done.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

boot();
