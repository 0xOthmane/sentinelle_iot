import { Hono } from "hono";
import { issueWsTicket } from "../ws/tickets.js";

const wsTicketRoute = new Hono();

// GET /ws-ticket (requires JWT) → one-time ticket for /ws?ticket=...
wsTicketRoute.get("/", (c) => {
  const { ticket, expiresIn } = issueWsTicket();
  return c.json({ ticket, expiresIn });
});

export { wsTicketRoute };
