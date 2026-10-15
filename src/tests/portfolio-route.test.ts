import Fastify, { type FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MarketPriceService } from "../services/market-price.js";
import { InvestmentEventService } from "../services/investment-event.js";
import { InvestmentEventRepository } from "../repositories/investment-event.js";
import { DividendService } from "../services/dividend.js";

import { portfolioRoutes } from "../routes/portfolio.js";
import { runMigrations } from "../db/migration-runner.ts";
import { PortfolioService } from "../services/portfolio.js";
import { TransactionService } from "../services/transaction.ts";

import cookie from "@fastify/cookie";
import { SessionService } from "../services/session.js";
import { SessionRepository } from "../repositories/session.js";

describe("Portfolio routes", () => {
    let app: FastifyInstance;
    let db: Database.Database;
    let portfolioService: PortfolioService;
    let transactionService: TransactionService;
    let marketPriceService: MarketPriceService;
    let sessionService: SessionService;

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
        sessionService = new SessionService(
            new SessionRepository(db),
        );

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

        portfolioService = new PortfolioService(db);

        const investmentEventService = new InvestmentEventService(
            new InvestmentEventRepository(db),
            transactionService,
            new DividendService(),
        );


        app = Fastify();

        await app.register(cookie);

        await app.register(portfolioRoutes, {
            portfolioService,
            transactionService,
            investmentEventService,
            sessionService,
        });
    });

    async function authenticatedCookie(userId = 1): Promise<string> {
        const session = sessionService.createSession(userId);
        return `session=${session.token}`;
    }

    afterAll(async () => {
        await app.close();
        db.close();
    });

    it("rejects an invalid calendar date for portfolio valuation", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/valuation?date=2026-02-31&exchange=NSE`,
            headers: {
                cookie: await authenticatedCookie(),
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it("returns portfolio valuation as of a date", async () => {

        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/valuation?date=2026-09-23&exchange=NSE`,
            headers: {
                cookie: await authenticatedCookie(),
            },
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
            headers: {
                cookie: await authenticatedCookie(),
            },
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
            headers: {
                cookie: await authenticatedCookie(),
            },
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
            headers: {
                cookie: await authenticatedCookie(),
            },
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
            headers: {
                cookie: await authenticatedCookie(),
            },
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

    it("calculates portfolio XIRR including SELL proceeds", async () => {
        const testPortfolioId = Number(
            db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (1, ?)
        `).run("Portfolio XIRR Sell Test").lastInsertRowid
        );

        // Invest ₹250,000.
        transactionService.create(
            testPortfolioId,
            securityId,
            "BUY",
            100,
            2500,
            "2025-09-23"
        );

        // Sell 40 shares for ₹120,000.
        transactionService.create(
            testPortfolioId,
            securityId,
            "SELL",
            40,
            3000,
            "2026-03-23"
        );

        // The remaining 60 shares are valued at ₹2,650 each.
        // Ending market value = 60 × ₹2,650 = ₹159,000.


        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${testPortfolioId}/performance?date=2026-09-23&exchange=NSE`,
            headers: {
                cookie: await authenticatedCookie(),
            },
        });

        expect(response.statusCode).toBe(200);



        const body = response.json();

        expect(body).toMatchObject({
            portfolio_id: testPortfolioId,
            date: "2026-09-23",
            exchange: "NSE",
            ending_market_value: 159000,
        });

        // Independent cash-flow expectations:
        // 2025-09-23: -₹250,000
        // 2026-03-23: +₹120,000
        // 2026-09-23: +₹159,000
        //
        // XIRR must solve the annualized return for these dated cash flows.
        expect(body.xirr).toBeCloseTo(0.151341076476, 6);
    });

    it("does not treat a stock split as an XIRR cash flow", async () => {
        const testPortfolioId = Number(
            db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (1, ?)
        `).run("Portfolio XIRR Split Test").lastInsertRowid
        );

        // Buy 100 shares at ₹2,500 each.
        transactionService.create(
            testPortfolioId,
            securityId,
            "BUY",
            100,
            2500,
            "2025-09-24"
        );

        // A 2:1 split doubles the quantity.
        transactionService.createSplit(
            testPortfolioId,
            securityId,
            2,
            1,
            "2026-03-24"
        );

        // After the split, 200 shares are worth ₹1,325 each.
        // The economic value remains ₹265,000.
        marketPriceService.create(
            "NSE",
            "Test Security",
            "2026-09-24",
            1325
        );

        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${testPortfolioId}/performance?date=2026-09-24&exchange=NSE`,
            headers: {
                cookie: await authenticatedCookie(),
            },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        expect(body).toMatchObject({
            portfolio_id: testPortfolioId,
            date: "2026-09-24",
            exchange: "NSE",
            ending_market_value: 265000,
        });

        // Only the original investment and ending value count as cash flows.
        // The split itself must not create a cash flow.
        expect(body.xirr).toBeCloseTo(0.06, 6);
    });

    it("excludes transactions after the valuation date from XIRR", async () => {
        const testPortfolioId = Number(
            db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (1, ?)
        `).run("Portfolio Historical XIRR Test").lastInsertRowid
        );

        // Included: invest ₹250,000 on September 23, 2025.
        transactionService.create(
            testPortfolioId,
            securityId,
            "BUY",
            100,
            2500,
            "2025-09-23"
        );

        // Excluded: this purchase occurs after the valuation date.
        transactionService.create(
            testPortfolioId,
            securityId,
            "BUY",
            50,
            2600,
            "2026-09-24"
        );

        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${testPortfolioId}/performance?date=2026-09-23&exchange=NSE`,
            headers: {
                cookie: await authenticatedCookie(),
            },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        // Only the original 100 shares count:
        // 100 × ₹2,650 = ₹265,000.
        expect(body.ending_market_value).toBe(265000);

        // The original investment grows from ₹250,000 to ₹265,000
        // over exactly 365 days: a 6% annualized return.
        expect(body.xirr).toBeCloseTo(0.06, 6);
    });

    it("includes eligible dividend income in portfolio performance", async () => {
        const testPortfolioId = Number(
            db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (1, ?)
        `).run("Portfolio Dividend XIRR Test").lastInsertRowid
        );

        // Invest ₹250,000 on September 23, 2025; value the shares one year later.
        transactionService.create(
            testPortfolioId,
            securityId,
            "BUY",
            100,
            2500,
            "2025-09-23"
        );

        // Shares are held before the September 22, 2026 dividend record date.
        // The dividend is paid on the valuation date.
        db.prepare(`
        INSERT INTO investment_events (
            security_id,
            event_type,
            ex_date,
            record_date,
            payment_date,
            amount_per_unit,
            currency
        )
        VALUES (?, 'DIVIDEND', ?, ?, ?, ?, ?)
    `).run(
            securityId,
            "2026-09-21",
            "2026-09-22",
            "2026-09-23",
            10,
            "INR"
        );



        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${testPortfolioId}/performance?date=2026-09-23&exchange=NSE`,
            headers: {
                cookie: await authenticatedCookie(),
            },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();

        // Cash flows:
        // 2025-09-23: -250,000 (BUY 100 shares)
        // 2026-09-23: +265,000 (ending market value)
        // 2026-09-23: +1,000 (100 shares × ₹10 dividend)
        const expectedXirr = 266000 / 250000 - 1;

        expect(body.ending_market_value).toBe(265000);
        expect(body.xirr).toBeCloseTo(expectedXirr, 6);
    });

    it("rejects unauthenticated access to a portfolio", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${portfolioId}`,
        });

        expect(response.statusCode).toBe(401);
    });

    it("rejects unauthenticated access to portfolio valuation", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/valuation?date=2026-09-23&exchange=NSE`,
        });

        expect(response.statusCode).toBe(401);
    });

});