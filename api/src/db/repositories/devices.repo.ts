import { getDb } from "../connection";
import type { Device } from "../../types";

export class DevicesRepo {
  private db = getDb();

  private stmtUpsert = this.db.prepare(`
    INSERT INTO devices (id, "group", status, last_seen)
    VALUES (@id, @group, @status, @lastSeen)
    ON CONFLICT(id) DO UPDATE SET
      "group"   = excluded."group",
      status    = excluded.status,
      last_seen = excluded.last_seen
  `);

  private stmtAll = this.db.prepare(`
    SELECT id,
           "group" AS "group",
           status,
           last_seen AS lastSeen
    FROM devices
  `);

  private stmtById = this.db.prepare(`
    SELECT id,
           "group" AS "group",
           status,
           last_seen AS lastSeen
    FROM devices
    WHERE id = ?
  `);

  private stmtUpdateStatus = this.db.prepare(`
    UPDATE devices
    SET status = @status, last_seen = @lastSeen
    WHERE id = @id
  `);

  private stmtUpdateLastSeen = this.db.prepare(`
    UPDATE devices
    SET last_seen = @lastSeen, status = 'online'
    WHERE id = @id
  `);

  private stmtOnline = this.db.prepare(`
    SELECT id,
           "group" AS "group",
           status,
           last_seen AS lastSeen
    FROM devices
    WHERE status = 'online'
  `);

  findAll(): Device[] {
    return this.stmtAll.all() as Device[];
  }

  findById(id: string): Device | undefined {
    return this.stmtById.get(id) as Device | undefined;
  }

  upsert(device: {
    id: string;
    group: string;
    status: string;
    lastSeen: number;
  }): void {
    this.stmtUpsert.run(device);
  }

  updateLastSeen(id: string, lastSeen: number): void {
    this.stmtUpdateLastSeen.run({ id, lastSeen });
  }

  updateStatus(id: string, status: string, lastSeen: number): void {
    this.stmtUpdateStatus.run({ id, status, lastSeen });
  }

  findOnlineDevices(): Device[] {
    return this.stmtOnline.all() as Device[];
  }
}
