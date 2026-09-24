import { getDb } from "../connection";

export class EventsRepo {
  private db = getDb();

  private stmtInsert = this.db.prepare(`
    INSERT INTO events (device, ts, type, content)
    VALUES (@device, @ts, @type, @content)
  `);

  insert(event: {
    device: string;
    ts: number;
    type: string;
    content: string;
  }): void {
    this.stmtInsert.run(event);
  }
}
