
import Database from "better-sqlite3";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";

import {
    assertSchemaReady,
} from "../db/schema-readiness.js";

import {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";


import { join } from "node:path";

describe("Schema readiness", () => {
    let db: Database.Database;
    let migrationsDir: string;

    beforeEach(() => {
        db = new Database(":memory:");

        migrationsDir = mkdtempSync(
            join(tmpdir(), "schema-readiness-"),
        );
    });

    afterEach(() => {
        db.close();

        rmSync(migrationsDir, {
            recursive: true,
            force: true,
        });
    });

    function addMigration(filename: string) {
        writeFileSync(
            join(migrationsDir, filename),
            "-- Test migration",
        );
    }

    function createMigrationsTable() {
        db.exec(`
            CREATE TABLE schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
        `);
    }

    function recordAppliedMigration(version: string) {
        db.prepare(`
            INSERT INTO schema_migrations (version, applied_at)
            VALUES (?, ?)
        `).run(version, new Date().toISOString());
    }

    it("passes when all available migrations have been applied", () => {
        addMigration("001_initial_schema.sql");
        addMigration("014_create_transaction_import_batches.sql");
        addMigration("015_new_feature.sql");

        createMigrationsTable();
        recordAppliedMigration("001");
        recordAppliedMigration("014");
        recordAppliedMigration("015");

        expect(() =>
            assertSchemaReady(db, migrationsDir),
        ).not.toThrow();
    });

    it("throws when the schema_migrations table does not exist", () => {
        addMigration("001_initial_schema.sql");

        expect(() =>
            assertSchemaReady(db, migrationsDir),
        ).toThrow(/Database schema is not initialized/);
    });

    it("throws when the latest available migration has not been applied", () => {
        addMigration("001_initial_schema.sql");
        addMigration("014_create_transaction_import_batches.sql");
        addMigration("015_new_feature.sql");

        createMigrationsTable();
        recordAppliedMigration("001");
        recordAppliedMigration("014");

        expect(() =>
            assertSchemaReady(db, migrationsDir),
        ).toThrow(/015/);
    });

    it("throws when an intermediate migration has not been applied", () => {
        const migrationsDir = mkdtempSync(
            path.join(tmpdir(), "schema-readiness-"),
        );

        const db = new Database(":memory:");

        try {
            for (const file of [
                "001_initial_schema.sql",
                "002_add_exchanges.sql",
                "003_create_transactions.sql",
            ]) {
                writeFileSync(path.join(migrationsDir, file), "");
            }

            db.exec(`
            CREATE TABLE schema_migrations (
                version TEXT PRIMARY KEY
            );
        `);

            db.prepare(
                "INSERT INTO schema_migrations (version) VALUES (?)",
            ).run("001");

            db.prepare(
                "INSERT INTO schema_migrations (version) VALUES (?)",
            ).run("003");

            expect(() => assertSchemaReady(db, migrationsDir))
                .toThrow(/002/);
        } finally {
            db.close();
            rmSync(migrationsDir, { recursive: true, force: true });
        }
    });

});
