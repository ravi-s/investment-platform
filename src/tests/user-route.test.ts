
import Database from "better-sqlite3";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.ts";
import { userRoutes } from "../routes/user.js";
import { UserService } from "../services/user.js";
import { SessionRepository } from "../repositories/session.js";
import { SessionService } from "../services/session.js";

describe("User routes", () => {
    let app: FastifyInstance;
    let db: Database.Database;
    let sessionService: SessionService;
    let userId: number;
    let otherUserId: number;

    beforeAll(async () => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");
        runMigrations(db);

        userId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Route User", "route-user@example.com").lastInsertRowid
        );

        otherUserId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Other User", "other-user@example.com").lastInsertRowid
        );

        sessionService = new SessionService(
            new SessionRepository(db),
        );

        app = Fastify();
        await app.register(cookie);

        // This route interface must be implemented with injectable dependencies.
        await app.register(userRoutes, {
            service: new UserService(db),
            sessionService,
        });
    });

    async function authenticatedCookie(id: number): Promise<string> {
        const session = sessionService.createSession(id);
        return `session=${session.token}`;
    }

    afterAll(async () => {
        await app.close();
        db.close();
    });

    it("rejects unauthenticated user retrieval", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/users/${userId}`,
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({
            error: "Authentication required",
        });
    });

    it("allows an authenticated user to retrieve their own record", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/users/${userId}`,
            headers: {
                cookie: await authenticatedCookie(userId),
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            id: userId,
            name: "Route User",
            email: "route-user@example.com",
        });
    });

    it("prevents a user from retrieving another user's record", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/users/${otherUserId}`,
            headers: {
                cookie: await authenticatedCookie(userId),
            },
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "User not found",
        });
    });

    it("returns 404 for a nonexistent user to an authenticated caller", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/users/999999",
            headers: {
                cookie: await authenticatedCookie(userId),
            },
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "User not found",
        });
    });

    it("allows public registration with valid data", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            payload: {
                name: "New User",
                email: "new-user@example.com",
            },
        });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toMatchObject({
            name: "New User",
            email: "new-user@example.com",
        });
    });

    it("rejects invalid registration data", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            payload: {
                name: "",
                email: "not-an-email",
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({
            error: "Invalid user data",
        });
    });
});
