import { Hono } from "hono";
import { DevicesRepo } from "../db/repositories/devices.repo";
import { EventsRepo } from "../db/repositories/events.repo";
import { publishCommand } from "../mqtt/publisher";
import { commandSchema } from "../utils/validation";

const commandsRoute = new Hono();

// POST /devices/:id/commands
commandsRoute.post("/:id/commands", async (c) => {
  const deviceId = c.req.param("id");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = commandSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid command",
        details: parsed.error.issues,
      },
      400,
    );
  }

  const devicesRepo = new DevicesRepo();
  const device = devicesRepo.findById(deviceId);

  if (!device) {
    return c.json({ error: "Device not found" }, 404);
  }

  const sent = publishCommand(device.group, deviceId, parsed.data);

  const eventsRepo = new EventsRepo();
  eventsRepo.insert({
    device: deviceId,
    ts: Math.floor(Date.now() / 1000),
    type: "command",
    content: JSON.stringify(parsed.data),
  });

  return c.json({ sent }, 202);
});

export { commandsRoute };
