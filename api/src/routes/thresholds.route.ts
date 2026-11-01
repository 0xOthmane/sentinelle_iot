import { Hono } from "hono";
import { DevicesRepo } from "../db/repositories/devices.repo";
import { ThresholdsRepo } from "../db/repositories/thresholds.repo";
import { thresholdsSchema } from "../utils/validation";

const thresholdsRoute = new Hono();

// GET /devices/:id/thresholds
thresholdsRoute.get("/:id/thresholds", (c) => {
  const deviceId = c.req.param("id");
  const repo = new ThresholdsRepo();

  const thresholds = repo.findByDevice(deviceId);

  // No row yet: all-null bounds tell the app the device is unconfigured
  // (no alerting); it then pushes its defaults via PUT.
  if (!thresholds) {
    return c.json({
      tMin: null,
      tMax: null,
      hMin: null,
      hMax: null,
      holdMinutes: 1,
    });
  }

  return c.json(thresholds);
});

// PUT /devices/:id/thresholds
thresholdsRoute.put("/:id/thresholds", async (c) => {
  const deviceId = c.req.param("id");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = thresholdsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid thresholds",
        details: parsed.error.issues,
      },
      400,
    );
  }

  // thresholds.device references devices(id): an unknown device would fail
  // with a foreign-key error (500) instead of a clear client error.
  if (!new DevicesRepo().findById(deviceId)) {
    return c.json({ error: "Device not found" }, 404);
  }

  const repo = new ThresholdsRepo();
  repo.upsert(deviceId, parsed.data);

  const saved = repo.findByDevice(deviceId);
  return c.json(saved);
});

export { thresholdsRoute };
