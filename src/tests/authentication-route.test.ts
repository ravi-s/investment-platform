import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import Database from "better-sqlite3";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";

import { runMigrations } from "../db/migration-runner.ts";
import { AuthenticationService } from "../services/authentication.js";
import { SessionService } from "../services/session.js";
import { CredentialRepository } from "../repositories/credential.js";
import { SessionRepository } from "../repositories/session.js";
import { authenticationRoutes } from "../routes/authentication.ts";

describe("Authentication routes", () => {
    let app: FastifyInstance;
    let db: Database.Database;
    let userId: number;
    let sessionService: SessionService;

    const email = "auth-route@example.com";
    const password = "Correct-Test-Password-123";
    const userName = "Authentication Test User";

    beforeAll(async () => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        userId = Number(
            db.prepare(`
          INSERT INTO users (name, email)
          VALUES (?, ?)
        `)
                .run(userName, email).lastInsertRowid,
        );

        const credentialRepository = new CredentialRepository(db);

        // Keep password hashing outside the scope of route tests.
        credentialRepository.create(
            userId,
            `test-hash:${password}`,
        );

        const userRepository = {
            findByEmail: (userEmail: string):
                | { id: number; name: string; email: string }
                | undefined =>
                db
                    .prepare(`
            SELECT id, name, email
            FROM users
            WHERE email = ?
          `)
                    .get(userEmail) as
                | { id: number; name: string; email: string }
                | undefined,
        };

        const passwordHasher = {
            verify: async (
                candidatePassword: string,
                storedHash: string,
            ): Promise<boolean> =>
                storedHash === `test-hash:${candidatePassword}`,
        };

        const authenticationService = new AuthenticationService(
            userRepository,
            credentialRepository,
            passwordHasher,
        );

        sessionService = new SessionService(
            new SessionRepository(db),
        );

        app = Fastify();

        // Cookie support must be registered before the authentication routes.
        await app.register(cookie);

        await app.register(authenticationRoutes, {
            authenticationService,
            sessionService,
        });

        await app.ready();
    });

    // Each test starts without sessions left by previous tests.
    beforeEach(() => {
        db.prepare("DELETE FROM sessions").run();
    });

    afterAll(async () => {
        await app.close();
        db.close();
    });

    it("logs in with valid credentials and creates a session", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: { email, password },
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual({
            user: {
                id: userId,
                name: userName,
                email,
            },
        });

        const setCookie = response.headers["set-cookie"];
        expect(setCookie).toBeDefined();

        const cookieHeader = Array.isArray(setCookie)
            ? setCookie.join("; ")
            : setCookie ?? "";

        expect(cookieHeader).toContain("HttpOnly");
        expect(cookieHeader).toContain("SameSite=Lax");
        expect(cookieHeader).toContain("Path=/");

        // The session token must not be exposed in the JSON response.
        expect(response.body).not.toContain("token");

        const storedSessions = db
            .prepare(`
        SELECT COUNT(*) AS count
        FROM sessions
        WHERE user_id = ?
      `)
            .get(userId) as { count: number };

        expect(storedSessions.count).toBe(1);
    });

    it("rejects an incorrect password without creating a session", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: {
                email,
                password: "Wrong-Test-Password",
            },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({
            error: "Invalid email or password",
        });

        const sessions = db
            .prepare(`
        SELECT COUNT(*) AS count
        FROM sessions
        WHERE user_id = ?
      `)
            .get(userId) as { count: number };

        expect(sessions.count).toBe(0);
    });

    it("rejects an unknown email with the same generic error", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload: {
                email: "unknown@example.com",
                password,
            },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({
            error: "Invalid email or password",
        });

        const sessions = db
            .prepare(`
        SELECT COUNT(*) AS count
        FROM sessions
      `)
            .get() as { count: number };

        expect(sessions.count).toBe(0);
    });

    it.each([
        {},
        { email },
        { password },
        { email: "not-an-email", password },
    ])("rejects invalid login input: %o", async (payload) => {
        const response = await app.inject({
            method: "POST",
            url: "/api/auth/login",
            payload,
        });

        expect(response.statusCode).toBe(400);

        const sessions = db
            .prepare(`
        SELECT COUNT(*) AS count
        FROM sessions
      `)
            .get() as { count: number };

        expect(sessions.count).toBe(0);
    });
});
