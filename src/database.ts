import { DatabaseSync } from "node:sqlite";

export const db = new DatabaseSync("app.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  )
`);
console.log("Database initialized");