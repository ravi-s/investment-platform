import Fastify, { type FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MarketPriceService } from "../services/market-price.js";

import { portfolioRoutes } from "../routes/portfolio.js";
import { runMigrations } from "../db/migration-runner.ts";
import { PortfolioService } from "../services/portfolio.js";
import { TransactionService } from "../services/transaction.ts";

describe("Portfolio routes", () => {
    let app: FastifyInstance;
    let db: Database.Database;
    let service: PortfolioService;
    let transactionService: TransactionService;
    let marketPriceService: MarketPriceService;

    let portfolioId: number;
    let securityId: number;
    let listingId: number;

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
        securityId = Number(
            db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Test Security").lastInsertRowid
        );
        listingId = Number(
            db.prepare(`
                INSERT INTO listings (security_id, exchange_id, symbol)
                VALUES (?, 1, 'Test Security')
            `).run(securityId).lastInsertRowid
        );
        transactionService = new TransactionService(db);
        marketPriceService = new MarketPriceService(db);

        transactionService.create(
            portfolioId,
            Number(securityId),
            "BUY",
            100,
            2500,
            "2026-09-22"
        );
        marketPriceService.create(
            "NSE",
            "Test Security",
            "2026-09-23",
            2650
        );

        service = new PortfolioService(db);


        app = Fastify();

        await app.register(portfolioRoutes, { service, transactionService, marketPriceService });
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

    it("returns portfolio valuation as of a date", async () => {



        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/valuation?date=2026-09-23&exchange=NSE`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual({
            portfolio_id: portfolioId,
            date: "2026-09-23",
            exchange: "NSE",
            positions: [
                {
                    security_id: securityId,
                    listing_id: listingId,
                    quantity: 100,
                    close_price: 2650,
                    market_value: 265000,
                },
            ],
            total_market_value: 265000,
        });
    });
    it("returns 422 when historical price is unavailable", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/valuation?date=2026-09-24&exchange=NSE`,
        });

        expect(response.statusCode).toBe(422);

        expect(response.json()).toEqual({
            error: `Historical price not found for listing ${listingId} on 2026-09-24`,
        });
    });

    it("returns zero valuation when the portfolio has no holdings on the requested date", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/valuation?date=2026-09-21&exchange=NSE`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual({
            portfolio_id: portfolioId,
            date: "2026-09-21",
            exchange: "NSE",
            positions: [],
            total_market_value: 0,
        });
    });

    it("includes transactions on the valuation date but excludes transactions after it", async () => {
        // Existing fixture:
        // BUY 100 on 2026-09-22
        //
        // Add a transaction after the valuation date.
        transactionService.create(
            portfolioId,
            securityId,
            "BUY",
            50,
            2600,
            "2026-09-24"
        );

        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/valuation?date=2026-09-23&exchange=NSE`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual({
            portfolio_id: portfolioId,
            date: "2026-09-23",
            exchange: "NSE",
            positions: [
                {
                    security_id: securityId,
                    listing_id: listingId,
                    quantity: 100,
                    close_price: 2650,
                    market_value: 265000,
                },
            ],
            total_market_value: 265000,
        });
    });


    it("returns portfolio XIRR using persisted transactions and ending market value", async () => {
        // Arrange: create a separate portfolio for this test.
        const testPortfolioId = Number(
            db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (1, ?)
        `).run("Portfolio XIRR Test").lastInsertRowid
        );

        // Invest ₹250,000 exactly one year before the valuation date.
        transactionService.create(
            testPortfolioId,
            securityId,
            "BUY",
            100,
            2500,
            "2025-09-23"
        );

        // The existing fixture has an NSE closing price of ₹2,650
        // for this security on 2026-09-23.

        // Act
        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${testPortfolioId}/performance?date=2026-09-23&exchange=NSE`,
        });

        // Assert
        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body).toMatchObject({
            portfolio_id: testPortfolioId,
            date: "2026-09-23",
            exchange: "NSE",
            ending_market_value: 265000,
        });

        // Independent expected return:
        // (₹265,000 / ₹250,000) - 1 = 6% over exactly one year.
        expect(body.xirr).toBeCloseTo(0.06, 6);
    });

});