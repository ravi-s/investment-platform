import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.js";
import { SessionRepository } from "../repositories/session.js";

describe("SessionRepository", () => {
    let db: Database.Database;
    let repository: SessionRepository;
    let userId: number;

    beforeAll(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        userId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Session Test User", "session-test@example.com")
                .lastInsertRowid
        );

        repository = new SessionRepository(db);
    });

    afterAll(() => {
        db.close();
    });

    it("creates and retrieves a session by token hash", () => {
        const tokenHash = "sha256-test-token-hash";
        const expiresAt = "2026-10-13T12:00:00.000Z";

        const created = repository.create(
            userId,
            tokenHash,
            expiresAt,
        );

        const retrieved = repository.findByTokenHash(tokenHash);

        expect(created).toMatchObject({
            user_id: userId,
            token_hash: tokenHash,
            expires_at: expiresAt,
        });

        expect(retrieved).toMatchObject({
            user_id: userId,
            token_hash: tokenHash,
            expires_at: expiresAt,
        });
    });

    it("rejects duplicate token hashes", () => {
        const tokenHash = "duplicate-token-hash";

        repository.create(
            userId,
            tokenHash,
            "2026-10-14T12:00:00.000Z",
        );

        expect(() => {
            repository.create(
                userId,
                tokenHash,
                "2026-10-15T12:00:00.000Z",
            );
        }).toThrow();
    });

    it("rejects sessions for a nonexistent user", () => {
        expect(() => {
            repository.create(
                999999,
                "nonexistent-user-token-hash",
                "2026-10-14T12:00:00.000Z",
            );
        }).toThrow();
    });

    it("returns undefined for an unknown token hash", () => {
        expect(
            repository.findByTokenHash("unknown-token-hash"),
        ).toBeUndefined();
    });

    it("deletes a session by token hash", () => {
        const tokenHash = "session-to-delete";

        repository.create(
            userId,
            tokenHash,
            "2026-10-14T12:00:00.000Z",
        );

        repository.deleteByTokenHash(tokenHash);

        expect(
            repository.findByTokenHash(tokenHash),
        ).toBeUndefined();
    });

    it("deletes sessions when the associated user is deleted", () => {
        const temporaryUserId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run(
                "Temporary Session User",
                "temporary-session@example.com",
            ).lastInsertRowid
        );

        const tokenHash = "cascade-delete-token";

        repository.create(
            temporaryUserId,
            tokenHash,
            "2026-10-14T12:00:00.000Z",
        );

        db.prepare("DELETE FROM users WHERE id = ?")
            .run(temporaryUserId);

        expect(
            repository.findByTokenHash(tokenHash),
        ).toBeUndefined();
    });
});
