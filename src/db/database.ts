import Database from "better-sqlite3";

const db: Database.Database = new Database("data/investment.db");

export default db;