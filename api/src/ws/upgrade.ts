import { createNodeWebSocket } from "@hono/node-ws";
import type { Hono } from "hono";
import { wsManager } from "./manager";
import { AlertStatesRepo } from "../db/repositories/alertStates.repo";
import { consumeWsTicket } from "./tickets";

export function setupWebSocket(app: Hono) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get(
    "/ws",
    async (c, next) => {
      const ticket = c.req.query("ticket") ?? "";
      if (!ticket || !consumeWsTicket(ticket)) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      await next();
    },
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        wsManager.register(ws);
        // Immediately resync missed alerts: a client that was disconnected
        // when "alert" fired gets the current active set as a snapshot.
        try {
          const repo = new AlertStatesRepo();
          const alerts = repo.getAllActive().map((s) => ({
            device: s.device,
            kind: s.kind,
            value: s.value,
            threshold: s.threshold,
            ts: s.updatedTs,
          }));
          wsManager.sendTo(ws, "snapshot", {
            alerts,
            ts: Math.floor(Date.now() / 1000),
          });
        } catch (err) {
          console.error("[WS] snapshot failed:", err);
        }
      },
    //   onMessage(_event, _ws) {},
      onClose(_event, ws) {
        wsManager.unregister(ws);
      },
      onError(_event, ws) {
        wsManager.unregister(ws);
      },
    })),
  );

  return { injectWebSocket };
}
