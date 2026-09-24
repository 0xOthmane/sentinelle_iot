import type { WSContext } from "hono/ws";

class WebSocketManager {
  private clients: Set<WSContext> = new Set();

  register(ws: WSContext): void {
    this.clients.add(ws);
    console.log(`[WS] Client connected. Total: ${this.clients.size}`);
  }

  unregister(ws: WSContext): void {
    this.clients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
  }

  broadcast(type: string, data: Record<string, unknown>): void {
    const message = JSON.stringify({ type, ...data });

    for (const ws of this.clients) {
      try {
        ws.send(message);
      } catch {
        this.clients.delete(ws);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
