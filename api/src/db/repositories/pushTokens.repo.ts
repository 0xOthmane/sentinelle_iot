import { getDb } from "../connection";

export class PushTokensRepo {
  private db = getDb();

  private stmtUpsert = this.db.prepare(`
    INSERT INTO push_tokens (token, platform, updated_at)
    VALUES (@token, @platform, @updatedAt)
    ON CONFLICT(token) DO UPDATE SET
      platform = excluded.platform,
      updated_at = excluded.updated_at
  `);

  private stmtAll = this.db.prepare(`
    SELECT token, platform
    FROM push_tokens
  `);

  private stmtDelete = this.db.prepare(`
    DELETE FROM push_tokens WHERE token = ?
  `);

  upsert(token: string, platform: string): void {
    this.stmtUpsert.run({
      token,
      platform,
      updatedAt: Math.floor(Date.now() / 1000),
    });
  }

  all(): Array<{ token: string; platform: string }> {
    return this.stmtAll.all() as Array<{ token: string; platform: string }>;
  }

  delete(token: string): void {
    this.stmtDelete.run(token);
  }
}
