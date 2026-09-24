import { createNodeWebSocket } from "@hono/node-ws";
import type { Hono } from "hono";
import { wsManager } from "./manager";

export function setupWebSocket(app: Hono) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get(
    "/ws",
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        wsManager.register(ws);
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
