import db from "./database.js";
import { runMigrations } from "./migration-runner.js";

runMigrations(db);