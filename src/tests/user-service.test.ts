import Database from "better-sqlite3";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { runMigrations } from "../db/migration-runner.ts";
import { UserService } from "../services/user.ts";

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

    it("should create a user", () => {
        const user = service.createUser(
            "Test User",
            "test@example.com"
        );

        expect(user).toBeDefined();
        expect(user?.id).toBeGreaterThan(0);
        expect(user?.name).toBe("Test User");
        expect(user?.email).toBe("test@example.com");
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

});