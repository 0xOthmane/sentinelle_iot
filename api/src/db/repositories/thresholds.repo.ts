import { getDb } from "../connection";
import type { Thresholds } from "../../types";

export class ThresholdsRepo {
  private db = getDb();

  private stmtGet = this.db.prepare(`
    SELECT
      t_min        AS tMin,
      t_max        AS tMax,
      h_min        AS hMin,
      h_max        AS hMax,
      hold_minutes AS holdMinutes
    FROM thresholds
    WHERE device = ?
  `);

  private stmtUpsert = this.db.prepare(`
    INSERT INTO thresholds
      (device, t_min, t_max, h_min, h_max, hold_minutes)
    VALUES
      (@device, @tMin, @tMax, @hMin, @hMax, @holdMinutes)
    ON CONFLICT(device) DO UPDATE SET
      t_min        = excluded.t_min,
      t_max        = excluded.t_max,
      h_min        = excluded.h_min,
      h_max        = excluded.h_max,
      hold_minutes = excluded.hold_minutes
  `);

  findByDevice(device: string): Thresholds | undefined {
    return this.stmtGet.get(device) as Thresholds | undefined;
  }

  upsert(device: string, thresholds: Thresholds): void {
    this.stmtUpsert.run({ device, ...thresholds });
  }
}
