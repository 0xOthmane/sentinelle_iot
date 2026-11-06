import { Hono } from "hono";
import { z } from "zod";
import { PushTokensRepo } from "../db/repositories/pushTokens.repo";

const pushTokenSchema = z.object({
  token: z.string().min(1).max(512),
  platform: z.enum(["android", "ios"]),
});

const notificationsRoute = new Hono();

notificationsRoute.post("/push-token", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = pushTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid push token", details: parsed.error.issues },
      400,
    );
  }

  new PushTokensRepo().upsert(parsed.data.token, parsed.data.platform);
  return c.json({ registered: true });
});

notificationsRoute.delete("/push-token", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = z.object({ token: z.string().min(1).max(512) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid push token" }, 400);
  }
  new PushTokensRepo().delete(parsed.data.token);
  return c.json({ registered: false });
});

export { notificationsRoute };
