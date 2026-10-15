import type { MiddlewareHandler } from "hono";
import { verifyAppToken } from "../utils/auth.js";

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/.exec(header);
  if (!match) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const payload = await verifyAppToken(match[1]);
    c.set("jwtPayload", payload);
    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
};
