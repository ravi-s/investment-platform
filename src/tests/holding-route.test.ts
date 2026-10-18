
import Database from "better-sqlite3";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.ts";
import { holdingRoutes } from "../routes/holding.js";
import { SessionRepository } from "../repositories/session.js";
import { SessionService } from "../services/session.js";
import { HoldingService } from "../services/holding.ts";


describe("Holding routes", () => {
    let db: Database.Database;
    let app: ReturnType<typeof Fastify>;
    let sessionService: SessionService;
    let portfolioId: number | bigint;
    let securityId: number | bigint;


    beforeAll(async () => {
        // Keep the suite isolated from any persistent development or test data.
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");
        runMigrations(db);

        // Create the minimum relational data needed by the routes.
        db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Holding Route User", "holding-route@example.com");

        portfolioId = db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (?, ?)
        `).run(1, "Holding Route Portfolio").lastInsertRowid;

        securityId = db.prepare(`
            INSERT INTO securities (name)
            VALUES (?)
        `).run("Holding Route Security").lastInsertRowid;

        app = Fastify();
        await app.register(cookie);

        // Build the same session dependencies used by the authenticated routes.
        sessionService = new SessionService(new SessionRepository(db));
        const holdingService = new HoldingService(db);

        // Inject the service through Fastify plugin options for session checks.
        await app.register(holdingRoutes, {
            service: holdingService,
            sessionService,
        });

    });

    afterAll(async () => {
        // Release both the Fastify server and its backing in-memory database.
        await app.close();
        db.close();
    });

    it("rejects unauthenticated holding creation", async () => {
        // A request without a session must not be allowed to create a holding.
        const response = await app.inject({
            method: "POST",
            url: "/api/portfolios/1/holdings",
            payload: {
                securityId: 1,
                quantity: 10,
            },
        });

        // Verify both the HTTP status and the public error response.
        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({
            error: "Authentication required",
        });
    });

    it("prevents retrieving another user's holding", async () => {

        const holdingResult = db.prepare(`
    INSERT INTO holdings (portfolio_id, security_id, quantity)
    VALUES (?, ?, ?)
`).run(Number(portfolioId), Number(securityId), 10);

        const holdingId = Number(holdingResult.lastInsertRowid);

        const result = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("Holding Reader", "holding-reader@example.com");

        const otherUserId = Number(result.lastInsertRowid);
        const session = sessionService.createSession(otherUserId);

        const response = await app.inject({
            method: "GET",
            url: `/api/holdings/${holdingId}`,
            headers: {
                cookie: `session=${session.token}`,
            },
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Holding not found",
        });
    });

    it("prevents creating a holding in another user's portfolio", async () => {
        const result = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("Other User", "other-user@example.com");

        const otherUserId = Number(result.lastInsertRowid);
        const session = sessionService.createSession(otherUserId);

        const response = await app.inject({
            method: "POST",
            url: `/api/portfolios/${portfolioId}/holdings`,
            headers: {
                cookie: `session=${session.token}`,
            },
            payload: {
                securityId,
                quantity: 10,
            },
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Portfolio not found",
        });
    });


});
