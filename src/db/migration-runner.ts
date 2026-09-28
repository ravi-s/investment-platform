import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

export function runMigrations(db: Database.Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
    `);

    const migrationsDir = path.join(
        import.meta.dirname,
        "migrations"
    );

    const files = fs
        .readdirSync(migrationsDir)
        .filter(file => file.endsWith(".sql"))
        .sort();

    console.log("Migration files:", files);

    for (const file of files) {
        const version = file.split("_")[0];

        const migration = db
            .prepare(`
                SELECT version
                FROM schema_migrations
                WHERE version = ?
            `)
            .get(version);

        if (migration) {
            console.log(`${file} already applied`);
            continue;
        }

        console.log(`Applying ${file}...`);

        const sql = fs.readFileSync(
            path.join(migrationsDir, file),
            "utf8"
        );

        const applyMigration = db.transaction(() => {
            db.exec(sql);

            db.prepare(`
                INSERT INTO schema_migrations (version, applied_at)
                VALUES (?, ?)
            `).run(
                version,
                new Date().toISOString()
            );
        });

        applyMigration();

        console.log(`${file} applied`);
    }
}