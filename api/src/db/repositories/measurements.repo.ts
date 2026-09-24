import { getDb } from "../connection";
import type { Measurement, RawMeasurement } from "../../types";

export class MeasurementsRepo {
  private db = getDb();

  private stmtInsert = this.db.prepare(`
    INSERT OR IGNORE INTO measurements
      (device, ts, t, h, seq, received_at)
    VALUES
      (@device, @ts, @t, @h, @seq, @receivedAt)
  `);

  private stmtRaw = this.db.prepare(`
    SELECT ts, t, h
    FROM measurements
    WHERE device = ? AND ts >= ? AND ts <= ?
    ORDER BY ts ASC
  `);

  insert(m: RawMeasurement): void {
    this.stmtInsert.run(m);
  }

  findRaw(device: string, from: number, to: number): Measurement[] {
    return this.stmtRaw.all(device, from, to) as Measurement[];
  }

  findAggregated(
    device: string,
    from: number,
    to: number,
    step: number,
  ): Measurement[] {
    // Cannot use prepared statement with dynamic step in both
    // SELECT and GROUP BY, so we build it safely (step is validated as int)
    return this.db
      .prepare(
        `
      SELECT
        (ts / ? * ?) AS ts,
        ROUND(AVG(t), 2) AS t,
        ROUND(AVG(h), 2) AS h
      FROM measurements
      WHERE device = ? AND ts >= ? AND ts <= ?
      GROUP BY (ts / ? * ?)
      ORDER BY ts ASC
    `,
      )
      .all(step, step, device, from, to, step, step) as Measurement[];
  }
}
