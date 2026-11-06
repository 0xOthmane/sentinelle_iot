import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { rateLimiter } from "hono-rate-limiter";
import { CONFIG } from "../config.js";

function getClientKey(c: Context): string {
  // Behind a tunnel/proxy the client can send its own X-Forwarded-For, and
  // the proxy appends the real address at the end: only the last hop can be
  // trusted. Using the first entry would let anyone pick their own bucket.
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }
  try {
    const info = getConnInfo(c);
    const addr =
      typeof info.remote.address === "string" ? info.remote.address : "";
    if (addr) return addr;
  } catch {
    // fall through to unknown bucket
  }
  return "unknown";
}

const rateLimitMessage = { error: "Too many requests" };

export const loginLimiter = rateLimiter({
  windowMs: CONFIG.RATE_LIMIT_LOGIN_WINDOW_MS,
  limit: CONFIG.RATE_LIMIT_LOGIN_MAX,
  keyGenerator: getClientKey,
  message: rateLimitMessage,
  statusCode: 429,
  standardHeaders: "draft-6",
  skipSuccessfulRequests: true,
});

export const apiLimiter = rateLimiter({
  windowMs: CONFIG.RATE_LIMIT_API_WINDOW_MS,
  limit: CONFIG.RATE_LIMIT_API_MAX,
  keyGenerator: getClientKey,
  message: rateLimitMessage,
  statusCode: 429,
  standardHeaders: "draft-6",
});
