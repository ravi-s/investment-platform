import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.js";
import { CredentialRepository } from "../repositories/credential.js";

describe("CredentialRepository", () => {
    let db: Database.Database;
    let repository: CredentialRepository;
    let userId: number;

    beforeAll(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        userId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Credential Test User", "credential-test@example.com")
                .lastInsertRowid
        );

        repository = new CredentialRepository(db);
    });

    afterAll(() => {
        db.close();
    });

    it("stores and retrieves a user's password hash", () => {
        const passwordHash = "$argon2id$test-password-hash";

        const created = repository.create(userId, passwordHash);
        const retrieved = repository.findByUserId(userId);

        expect(created).toMatchObject({
            user_id: userId,
            password_hash: passwordHash,
        });

        expect(retrieved).toMatchObject({
            user_id: userId,
            password_hash: passwordHash,
        });
    });

    it("does not allow duplicate credentials for the same user", () => {
        expect(() => {
            repository.create(userId, "$argon2id$another-hash");
        }).toThrow();
    });

    it("rejects credentials for a nonexistent user", () => {
        expect(() => {
            repository.create(999999, "$argon2id$test-hash");
        }).toThrow();
    });

    it("returns undefined when a user has no credentials", () => {
        const anotherUserId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("No Credentials User", "no-credentials@example.com")
                .lastInsertRowid
        );

        expect(repository.findByUserId(anotherUserId)).toBeUndefined();
    });

    it("deletes credentials when the associated user is deleted", () => {
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);

        expect(repository.findByUserId(userId)).toBeUndefined();
    });
});
