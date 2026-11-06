import { getDb } from "../connection";

export interface AlertState {
  device: string;
  kind: string;
  firstViolationTs: number;
  alerted: boolean;
  value: number | null;
  threshold: number | null;
  updatedTs: number;
}

interface AlertStateRow {
  device: string;
  kind: string;
  first_violation_ts: number;
  alerted: number;
  value: number | null;
  threshold: number | null;
  updated_ts: number;
}

function toAlertState(row: AlertStateRow): AlertState {
  return {
    device: row.device,
    kind: row.kind,
    firstViolationTs: row.first_violation_ts,
    alerted: row.alerted === 1,
    value: row.value,
    threshold: row.threshold,
    updatedTs: row.updated_ts,
  };
}

export class AlertStatesRepo {
  private db = getDb();

  private stmtGet = this.db.prepare(`
    SELECT device, kind, first_violation_ts, alerted, value, threshold, updated_ts
    FROM alert_states
    WHERE device = ? AND kind = ?
  `);

  private stmtUpsert = this.db.prepare(`
    INSERT INTO alert_states
      (device, kind, first_violation_ts, alerted, value, threshold, updated_ts)
    VALUES
      (@device, @kind, @firstViolationTs, @alerted, @value, @threshold, @updatedTs)
    ON CONFLICT(device, kind) DO UPDATE SET
      first_violation_ts = excluded.first_violation_ts,
      alerted            = excluded.alerted,
      value              = excluded.value,
      threshold          = excluded.threshold,
      updated_ts         = excluded.updated_ts
  `);

  private stmtDelete = this.db.prepare(`
    DELETE FROM alert_states WHERE device = ? AND kind = ?
  `);

  private stmtActiveByDevice = this.db.prepare(`
    SELECT device, kind, first_violation_ts, alerted, value, threshold, updated_ts
    FROM alert_states
    WHERE device = ? AND alerted = 1
    ORDER BY updated_ts ASC
  `);

  private stmtAllActive = this.db.prepare(`
    SELECT device, kind, first_violation_ts, alerted, value, threshold, updated_ts
    FROM alert_states
    WHERE alerted = 1
    ORDER BY updated_ts ASC
  `);

  get(device: string, kind: string): AlertState | undefined {
    const row = this.stmtGet.get(device, kind) as AlertStateRow | undefined;
    return row ? toAlertState(row) : undefined;
  }

  upsert(state: {
    device: string;
    kind: string;
    firstViolationTs: number;
    alerted: boolean;
    value: number | null;
    threshold: number | null;
    updatedTs: number;
  }): void {
    this.stmtUpsert.run({
      device: state.device,
      kind: state.kind,
      firstViolationTs: state.firstViolationTs,
      alerted: state.alerted ? 1 : 0,
      value: state.value,
      threshold: state.threshold,
      updatedTs: state.updatedTs,
    });
  }

  delete(device: string, kind: string): void {
    this.stmtDelete.run(device, kind);
  }

  getActive(device: string): AlertState[] {
    const rows = this.stmtActiveByDevice.all(device) as AlertStateRow[];
    return rows.map(toAlertState);
  }

  getAllActive(): AlertState[] {
    const rows = this.stmtAllActive.all() as AlertStateRow[];
    return rows.map(toAlertState);
  }
}
