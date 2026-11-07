import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_PATH || "data/investment.db";
const dbDir = dirname(dbPath);

// Ensure the parent directory exists
mkdirSync(dbDir, { recursive: true });

const db: Database.Database = new Database(dbPath);

db.pragma("foreign_keys = ON");

export default db;