import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.js";

describe("Authentication schema", () => {
    let db: Database.Database;

    beforeAll(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);
    });

    afterAll(() => {
        db.close();
    });

    it("creates the user_credentials table", () => {
        const table = db
            .prepare(`
                SELECT name
                FROM sqlite_master
                WHERE type = 'table'
                  AND name = 'user_credentials'
            `)
            .get();

        expect(table).toBeDefined();
    });

    it("creates the sessions table", () => {
        const table = db
            .prepare(`
                SELECT name
                FROM sqlite_master
                WHERE type = 'table'
                  AND name = 'sessions'
            `)
            .get();

        expect(table).toBeDefined();
    });

    it("requires each credential to reference an existing user", () => {
        expect(() => {
            db.prepare(`
                INSERT INTO user_credentials (user_id, password_hash)
                VALUES (?, ?)
            `).run(999, "test-hash");
        }).toThrow();
    });

    it("requires each session to reference an existing user", () => {
        expect(() => {
            db.prepare(`
                INSERT INTO sessions (token_hash, user_id, expires_at)
                VALUES (?, ?, ?)
            `).run("test-token-hash", 999, "2026-12-31T00:00:00.000Z");
        }).toThrow();
    });

    it("does not allow duplicate session token hashes", () => {
        const userId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Auth Test User", "auth-schema@example.com").lastInsertRowid
        );

        db.prepare(`
            INSERT INTO sessions (token_hash, user_id, expires_at)
            VALUES (?, ?, ?)
        `).run("unique-token-hash", userId, "2026-12-31T00:00:00.000Z");

        expect(() => {
            db.prepare(`
                INSERT INTO sessions (token_hash, user_id, expires_at)
                VALUES (?, ?, ?)
            `).run("unique-token-hash", userId, "2027-01-31T00:00:00.000Z");
        }).toThrow();
    });

    it("deletes credentials and sessions when their user is deleted", () => {
        const userId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Deletion Test User", "auth-delete@example.com").lastInsertRowid
        );

        db.prepare(`
            INSERT INTO user_credentials (user_id, password_hash)
            VALUES (?, ?)
        `).run(userId, "test-password-hash");

        db.prepare(`
            INSERT INTO sessions (token_hash, user_id, expires_at)
            VALUES (?, ?, ?)
        `).run(
            "deletion-test-token-hash",
            userId,
            "2026-12-31T00:00:00.000Z"
        );

        db.prepare("DELETE FROM users WHERE id = ?").run(userId);

        const credentials = db.prepare(`
            SELECT user_id
            FROM user_credentials
            WHERE user_id = ?
        `).get(userId);

        const sessions = db.prepare(`
            SELECT id
            FROM sessions
            WHERE user_id = ?
        `).get(userId);

        expect(credentials).toBeUndefined();
        expect(sessions).toBeUndefined();
    });
});
