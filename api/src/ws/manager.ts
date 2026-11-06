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

  private isOpen(ws: WSContext): boolean {
    const readyState = (ws as unknown as { readyState?: unknown }).readyState;
    // Underlying ws states: 0 CONNECTING, 1 OPEN, 2 CLOSING, 3 CLOSED.
    // If the adapter doesn't expose readyState, assume send is safe to try.
    if (readyState === undefined) return true;
    return readyState === 1;
  }

  private safeSend(ws: WSContext, message: string): boolean {
    if (!this.isOpen(ws)) return false;
    try {
      ws.send(message);
      return true;
    } catch {
      this.clients.delete(ws);
      return false;
    }
  }

  sendTo(ws: WSContext, type: string, data: Record<string, unknown>): boolean {
    const message = JSON.stringify({ type, ...data });
    const ok = this.safeSend(ws, message);
    if (!ok) {
      console.warn(`[WS] snapshot send failed (type=${type}). Total: ${this.clients.size}`);
    }
    return ok;
  }

  broadcast(
    type: string,
    data: Record<string, unknown>,
  ): { total: number; delivered: number; failed: number } {
    const message = JSON.stringify({ type, ...data });
    // Copy: safeSend may delete dead clients while iterating.
    const clients = [...this.clients];
    let delivered = 0;
    let failed = 0;

    for (const ws of clients) {
      if (this.safeSend(ws, message)) {
        delivered += 1;
      } else {
        failed += 1;
      }
    }

    const device =
      typeof data.device === "string" ? ` device=${data.device}` : "";
    // Measurements are high-frequency: only log them on delivery problems
    // to avoid flooding, but always log alerts / status / snapshots.
    if (type !== "measurement" || failed > 0 || clients.length === 0) {
      console.log(
        `[WS] broadcast type=${type}${device} total=${clients.length} delivered=${delivered} failed=${failed}`,
      );
    } else {
      console.debug(
        `[WS] broadcast type=${type}${device} total=${clients.length} delivered=${delivered} failed=${failed}`,
      );
    }

    return { total: clients.length, delivered, failed };
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WebSocketManager();
