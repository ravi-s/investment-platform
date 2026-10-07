import Fastify, { type FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { portfolioRoutes } from "../routes/portfolio.js";
import { runMigrations } from "../db/migration-runner.ts";
import { PortfolioService } from "../services/portfolio.js";

describe("Portfolio routes", () => {
    let app: FastifyInstance;
    let db: Database.Database;
    let service: PortfolioService;
    let portfolioId: number;

    beforeAll(async () => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Portfolio Route User", "portfolio-route@example.com");

        portfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Portfolio Route Test").lastInsertRowid
        );

        service = new PortfolioService(db);

        app = Fastify();

        await app.register(portfolioRoutes, { service });
    });

    afterAll(async () => {
        await app.close();
        db.close();
    });

    it("rejects an invalid calendar date for portfolio valuation", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/valuation?date=2026-02-31&exchange=NSE`,
        });

        expect(response.statusCode).toBe(400);
    });
});