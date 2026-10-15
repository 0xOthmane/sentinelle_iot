import type Database from "better-sqlite3";

export function initializeSchema(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id            TEXT PRIMARY KEY,
      "group"       TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'offline'
                    CHECK(status IN ('online','offline')),
      last_seen     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS measurements (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      device        TEXT NOT NULL REFERENCES devices(id),
      ts            INTEGER NOT NULL,
      t             REAL,
      h             REAL,
      seq           INTEGER,
      received_at   INTEGER NOT NULL,
      UNIQUE(device, ts, seq)
    );

    CREATE INDEX IF NOT EXISTS idx_measurements_device_ts
      ON measurements(device, ts);

    CREATE TABLE IF NOT EXISTS thresholds (
      device        TEXT PRIMARY KEY REFERENCES devices(id),
      t_min         REAL,
      t_max         REAL,
      h_min         REAL,
      h_max         REAL,
      hold_minutes  INTEGER NOT NULL DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS events (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      device        TEXT NOT NULL REFERENCES devices(id),
      ts            INTEGER NOT NULL,
      type          TEXT NOT NULL
                    CHECK(type IN ('alert','alert_cleared','device_status','command')),
      content       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_device_ts
      ON events(device, ts);

    -- Durable alert/violation state so a missed WS frame or an API
    -- restart doesn't lose active alerts or in-progress hold windows.
    CREATE TABLE IF NOT EXISTS alert_states (
      device              TEXT NOT NULL REFERENCES devices(id),
      kind                TEXT NOT NULL,
      first_violation_ts  INTEGER NOT NULL,
      alerted             INTEGER NOT NULL DEFAULT 0
                          CHECK(alerted IN (0,1)),
      value               REAL,
      threshold           REAL,
      updated_ts          INTEGER NOT NULL,
      PRIMARY KEY (device, kind)
    );
  `);
}
