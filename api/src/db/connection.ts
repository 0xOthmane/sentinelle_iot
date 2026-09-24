import Database from "better-sqlite3";
import { CONFIG } from "../config.js";
import { initializeSchema } from "./schema";

let db: Database.Database;
    
export function getDb(): Database.Database {
  if (!db) {
    db = new Database(CONFIG.DB_PATH);
    initializeSchema(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
