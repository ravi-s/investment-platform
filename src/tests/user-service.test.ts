import Database from "better-sqlite3";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { runMigrations } from "../db/migration-runner.ts";
import { UserService } from "../services/user.ts";
import { DuplicateEmailError } from "../errors/duplicate-email-error.ts";

describe("UserService", () => {
    let db: Database.Database;
    let service: UserService;

    beforeEach(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        service = new UserService(db);
    });

    afterEach(() => {
        db.close();
    });



    it("should register a user with hashed password credentials", async () => {
        const password = "Test-Password-123";

        const user = await service.registerUser(
            "Registration Test User",
            "registration@example.com",
            password,
        );

        expect(user).toBeDefined();
        expect(user?.id).toBeGreaterThan(0);

        const credential = db.prepare(`
        SELECT password_hash
        FROM user_credentials
        WHERE user_id = ?
    `).get(user!.id) as { password_hash: string } | undefined;

        expect(credential).toBeDefined();
        expect(credential?.password_hash).not.toBe(password);
    });

    it("should store a valid Argon2id password hash", async () => {
        const password = "Test-Password-123";

        const user = await service.registerUser(
            "Hash Test User",
            "hash@example.com",
            password,
        );

        const credential = db.prepare(`
        SELECT password_hash
        FROM user_credentials
        WHERE user_id = ?
    `).get(user!.id) as { password_hash: string };

        expect(credential.password_hash).toMatch(/^\$argon2id\$/);
        expect(credential.password_hash).not.toBe(password);
    });

    it("should roll back user creation if credential creation fails", async () => {
        db.exec(`
            CREATE TRIGGER fail_credential_insert
            BEFORE INSERT ON user_credentials
            BEGIN
                SELECT RAISE(ABORT, 'Credential creation failed');
            END;
    `);

        await expect(
            service.registerUser(
                "Rollback User",
                "rollback@example.com",
                "Test-Password-123",
            ),
        ).rejects.toThrow("Credential creation failed");

        const result = db.prepare(`
            SELECT COUNT(*) AS count
            FROM users
            WHERE email = ?
        `).get("rollback@example.com") as { count: number };

        expect(result.count).toBe(0);
    });

    it("should reject registration with an existing email", async () => {
        const email = "duplicate@example.com";

        await service.registerUser(
            "First User",
            email,
            "Test-Password-123",
        );

        await expect(
            service.registerUser(
                "Second User",
                email,
                "Another-Password-123",
            ),
        ).rejects.toThrow(DuplicateEmailError);

        const result = db.prepare(`
        SELECT COUNT(*) AS count
        FROM users
        WHERE email = ?
    `).get(email) as { count: number };

        expect(result.count).toBe(1);

        const credentialResult = db.prepare(`
        SELECT COUNT(*) AS count
        FROM user_credentials
        WHERE user_id = (
            SELECT id FROM users WHERE email = ?
        )
    `).get(email) as { count: number };

        expect(credentialResult.count).toBe(1);
    });
});