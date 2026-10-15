import { randomUUID } from "node:crypto";
import { CONFIG } from "../config.js";

const tickets = new Map<string, number>();

export function issueWsTicket(): { ticket: string; expiresIn: number } {
  const ticket = randomUUID();
  const expiresIn = CONFIG.WS_TICKET_TTL_SECONDS;
  tickets.set(ticket, Date.now() + expiresIn * 1000);
  return { ticket, expiresIn };
}

/** Single-use: returns true only once, before expiry. */
export function consumeWsTicket(ticket: string): boolean {
  const expiresAt = tickets.get(ticket);
  tickets.delete(ticket);
  if (!expiresAt) return false;
  return Date.now() <= expiresAt;
}

// Periodic sweep so expired tickets don't accumulate.
setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of tickets) {
    if (expiresAt < now) tickets.delete(key);
  }
}, 60_000).unref();
