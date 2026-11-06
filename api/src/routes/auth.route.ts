import { z } from "zod";
import { Hono } from "hono";
import { isAuthConfigured, signAppToken, verifyPassword } from "../utils/auth.js";
import { CONFIG } from "../config.js";

const loginSchema = z.object({
  password: z.string().min(1),
});

const authRoute = new Hono();

// POST /auth/login → { token, tokenType, expiresIn, expiresAt }
authRoute.post("/login", async (c) => {
  if (!isAuthConfigured()) {
    return c.json({ error: "Auth not configured" }, 500);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid credentials", details: parsed.error.issues },
      400,
    );
  }

  if (!verifyPassword(parsed.data.password)) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const { token, expiresAt } = await signAppToken();
  return c.json({
    token,
    tokenType: "Bearer",
    expiresIn: CONFIG.JWT_EXPIRES_SECONDS,
    expiresAt,
  });
});

export { authRoute };
