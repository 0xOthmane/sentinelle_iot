import { timingSafeEqual } from "node:crypto";
import { sign, verify } from "hono/jwt";
import { CONFIG } from "../config.js";

export type AppJwtPayload = {
  sub: string;
  iat: number;
  exp: number;
};

const ALG = "HS256";

export function isAuthConfigured(): boolean {
  return CONFIG.APP_PASSWORD.length > 0 && CONFIG.JWT_SECRET.length > 0;
}

export function verifyPassword(candidate: string): boolean {
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(CONFIG.APP_PASSWORD, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function signAppToken(): Promise<{
  token: string;
  expiresAt: number;
}> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + CONFIG.JWT_EXPIRES_SECONDS;
  const token = await sign({ sub: "family", iat, exp }, CONFIG.JWT_SECRET, ALG);
  return { token, expiresAt: exp };
}

export async function verifyAppToken(token: string): Promise<AppJwtPayload> {
  const payload = await verify(token, CONFIG.JWT_SECRET, ALG);
  if (payload.sub !== "family") throw new Error("Invalid subject");
  return payload as AppJwtPayload;
}
