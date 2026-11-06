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
      hold_seconds AS holdSeconds
    FROM thresholds
    WHERE device = ?
  `);

  private stmtUpsert = this.db.prepare(`
    INSERT INTO thresholds
      (device, t_min, t_max, h_min, h_max, hold_seconds)
    VALUES
      (@device, @tMin, @tMax, @hMin, @hMax, @holdSeconds)
    ON CONFLICT(device) DO UPDATE SET
      t_min        = excluded.t_min,
      t_max        = excluded.t_max,
      h_min        = excluded.h_min,
      h_max        = excluded.h_max,
      hold_seconds = excluded.hold_seconds
  `);

  findByDevice(device: string): Thresholds | undefined {
    return this.stmtGet.get(device) as Thresholds | undefined;
  }

  upsert(device: string, thresholds: Thresholds): void {
    this.stmtUpsert.run({ device, ...thresholds });
  }
}
