
import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function assertSchemaReady(
    db: Database.Database,
    migrationsDir = path.join(import.meta.dirname, "migrations"),
): void {
    const migrationsTable = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'schema_migrations'
    `).get();

    if (!migrationsTable) {
        throw new Error(
            "Database schema is not initialized. " +
            "Run: npx tsx src/db/migrate.ts"
        );
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => /^\d+_.+\.sql$/.test(file))
        .sort();

    if (migrationFiles.length === 0) {
        throw new Error("No migration files found.");
    }


    for (const file of migrationFiles) {
        const version = file.split("_")[0];

        const migration = db.prepare(`
            SELECT version
            FROM schema_migrations
            WHERE version = ?
        `).get(version);

        if (!migration) {
            throw new Error(
                `Database schema is outdated. ` +
                `Required migration ${version} is missing. ` +
                "Run: npx tsx src/db/migrate.ts"
            );
        }
    }


}
