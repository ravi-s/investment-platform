import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";

import Database from "better-sqlite3";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { transactionRoutes } from "../routes/transaction.js";
import { runMigrations } from "../db/migration-runner.ts";
import { TransactionService } from "../services/transaction.js";
import { SessionService } from "../services/session.js";
import { SessionRepository } from "../repositories/session.js";
import { TransactionImportService } from "../services/transaction-import-service.js";

describe("Transaction routes", () => {
    let app: FastifyInstance;
    let db: Database.Database;
    let service: TransactionService;
    let sessionService: SessionService;
    let userId: number;
    let portfolioId: number;
    let securityId: number;
    let importService: TransactionImportService;

    beforeEach(async () => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        userId = Number(db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Route User", "route@example.com").lastInsertRowid);

        portfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(userId, "Route Portfolio").lastInsertRowid
        );

        securityId = Number(
            db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Route Security").lastInsertRowid
        );

        service = new TransactionService(db);
        importService = new TransactionImportService(db);
        sessionService = new SessionService(
            new SessionRepository(db),
        );

        app = Fastify();

        await app.register(cookie);
        await app.register(transactionRoutes, { service, sessionService, importService });
    });

    async function authenticatedCookie(requestedUserId = userId): Promise<string> {
        const session = sessionService.createSession(requestedUserId);
        return `session=${session.token}`;
    }

    async function injectAuthenticated(options: {
        method: "GET" | "POST";
        url: string;
        payload?: Record<string, unknown>;
    }, requestedUserId = userId) {
        return app.inject({
            ...options,
            headers: {
                cookie: await authenticatedCookie(requestedUserId),
            },
        });
    }

    afterEach(async () => {
        await app.close();
        db.close();
    });

    it("creates a BUY transaction through the API", async () => {
        const response = await injectAuthenticated({
            method: "POST",
            url: "/api/transactions",
            payload: {
                portfolioId,
                securityId,
                type: "BUY",
                quantity: 10,
                price: 100,
                transactionDate: "2026-09-29",
            },
        });

        expect(response.statusCode).toBe(201);

        expect(response.json()).toMatchObject({
            portfolio_id: portfolioId,
            security_id: securityId,
            type: "BUY",
            quantity: 10,
            price: 100,
            transaction_date: "2026-09-29",
        });
    });

    it("creates a SPLIT transaction through the API", async () => {
        const response = await injectAuthenticated({
            method: "POST",
            url: "/api/transactions",
            payload: {
                portfolioId,
                securityId,
                type: "SPLIT",
                splitNumerator: 2,
                splitDenominator: 1,
                transactionDate: "2026-09-30",
            },
        });

        expect(response.statusCode).toBe(201);

        expect(response.json()).toMatchObject({
            portfolio_id: portfolioId,
            security_id: securityId,
            type: "SPLIT",
            quantity: null,
            price: null,
            split_numerator: 2,
            split_denominator: 1,
            transaction_date: "2026-09-30",
        });
    });

    it.each(["BUY", "SELL", "SPLIT"] as const)(
        "rejects a %s transaction with an invalid calendar date",
        async (type) => {
            const transactionDetails =
                type === "SPLIT"
                    ? { splitNumerator: 2, splitDenominator: 1 }
                    : { quantity: 1, price: 100 };

            const response = await injectAuthenticated({
                method: "POST",
                url: "/api/transactions",
                payload: {
                    portfolioId,
                    securityId,
                    type,
                    ...transactionDetails,
                    transactionDate: "2026-02-30",
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.json()).toMatchObject({
                error: "Invalid transaction data",
            });
        }
    );

    it.each(["BUY", "SELL", "SPLIT"] as const)(
        "rejects a %s transaction with a malformed date",
        async (type) => {
            const transactionDetails =
                type === "SPLIT"
                    ? { splitNumerator: 2, splitDenominator: 1 }
                    : { quantity: 1, price: 100 };

            const response = await injectAuthenticated({
                method: "POST",
                url: "/api/transactions",
                payload: {
                    portfolioId,
                    securityId,
                    type,
                    ...transactionDetails,
                    transactionDate: "not-a-date",
                },
            });

            expect(response.statusCode).toBe(400);
        }
    );

    it("retrieves a SPLIT transaction by ID through the API", async () => {
        const split = service.createSplit(
            portfolioId,
            securityId,
            2,
            1,
            "2026-09-30"
        ) as { id: number };

        const response = await injectAuthenticated({
            method: "GET",
            url: `/api/transactions/${split.id}`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toMatchObject({
            id: split.id,
            portfolio_id: portfolioId,
            security_id: securityId,
            type: "SPLIT",
            quantity: null,
            price: null,
            split_numerator: 2,
            split_denominator: 1,
            transaction_date: "2026-09-30",
        });
    });


    it("rejects unauthenticated access to a transaction by ID", async () => {
        const transaction = service.createSplit(
            portfolioId,
            securityId,
            2,
            1,
            "2026-09-30"
        ) as { id: number };

        const response = await app.inject({
            method: "GET",
            url: `/api/transactions/${transaction.id}`,
        });

        expect(response.statusCode).toBe(401);
    });

    it("prevents one user from retrieving another user's transaction", async () => {
        const transaction = service.createSplit(
            portfolioId,
            securityId,
            2,
            1,
            "2026-09-30"
        ) as { id: number };

        // Create a second user.
        const result = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("Other User", "other@example.com");

        const otherUserId = Number(result.lastInsertRowid);

        const response = await injectAuthenticated(
            {
                method: "GET",
                url: `/api/transactions/${transaction.id}`,
            },
            otherUserId
        );

        expect(response.statusCode).toBe(404);
    });


    it("returns 404 when retrieving a transaction that does not exist", async () => {
        const response = await injectAuthenticated({
            method: "GET",
            url: "/api/transactions/999999",
        });

        expect(response.statusCode).toBe(404);

        expect(response.json()).toEqual({
            error: "Transaction not found",
        });
    });
    it("rejects a SPLIT with an invalid numerator", async () => {
        const response = await injectAuthenticated({
            method: "POST",
            url: "/api/transactions",
            payload: {
                portfolioId,
                securityId,
                type: "SPLIT",
                splitNumerator: 0,
                splitDenominator: 1,
                transactionDate: "2026-09-30",
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it("rejects a SPLIT with an invalid denominator", async () => {
        const response = await injectAuthenticated({
            method: "POST",
            url: "/api/transactions",
            payload: {
                portfolioId,
                securityId,
                type: "SPLIT",
                splitNumerator: 2,
                splitDenominator: 0,
                transactionDate: "2026-09-30",
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it("rejects a SPLIT with a non-integer numerator", async () => {
        const response = await injectAuthenticated({
            method: "POST",
            url: "/api/transactions",
            payload: {
                portfolioId,
                securityId,
                type: "SPLIT",
                splitNumerator: 2.5,
                splitDenominator: 1,
                transactionDate: "2026-09-30",
            },
        });

        expect(response.statusCode).toBe(400);
    });
    it("rejects a SPLIT with a non-integer denominator", async () => {
        const response = await injectAuthenticated({
            method: "POST",
            url: "/api/transactions",
            payload: {
                portfolioId,
                securityId,
                type: "SPLIT",
                splitNumerator: 2,
                splitDenominator: 1.5,
                transactionDate: "2026-09-30",
            },
        });

        expect(response.statusCode).toBe(400);
    });
    it("rejects a SPLIT without a numerator", async () => {
        const response = await injectAuthenticated({
            method: "POST",
            url: "/api/transactions",
            payload: {
                portfolioId,
                securityId,
                type: "SPLIT",
                splitDenominator: 1,
                transactionDate: "2026-09-30",
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it("rejects a SPLIT without a denominator", async () => {
        const response = await injectAuthenticated({
            method: "POST",
            url: "/api/transactions",
            payload: {
                portfolioId,
                securityId,
                type: "SPLIT",
                splitNumerator: 2,
                transactionDate: "2026-09-30",
            },
        });

        expect(response.statusCode).toBe(400);
    });

    it("creates a SELL transaction through the API", async () => {
        service.create(
            portfolioId,
            securityId,
            "BUY",
            10,
            100,
            "2026-09-29"
        );

        const response = await injectAuthenticated({
            method: "POST",
            url: "/api/transactions",
            payload: {
                portfolioId,
                securityId,
                type: "SELL",
                quantity: 4,
                price: 120,
                transactionDate: "2026-09-30",
            },
        });

        expect(response.statusCode).toBe(201);

        expect(response.json()).toMatchObject({
            portfolio_id: portfolioId,
            security_id: securityId,
            type: "SELL",
            quantity: 4,
            price: 120,
            transaction_date: "2026-09-30",
        });
    });

    it("rejects a SELL when the holding is insufficient", async () => {
        const isolatedPortfolioId = Number(
            db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (?, ?)
        `).run(userId, "Insufficient Sell Portfolio").lastInsertRowid
        );

        service.create(
            isolatedPortfolioId,
            securityId,
            "BUY",
            10,
            100,
            "2026-09-29"
        );

        const response = await injectAuthenticated({
            method: "POST",
            url: "/api/transactions",
            payload: {
                portfolioId: isolatedPortfolioId,
                securityId,
                type: "SELL",
                quantity: 11,
                price: 120,
                transactionDate: "2026-09-30",
            },
        });

        expect(response.statusCode).toBe(409);

        expect(response.json()).toEqual({
            error: "Insufficient holding",
        });
    });

    it("returns transactions for a portfolio", async () => {
        service.create(
            portfolioId,
            securityId,
            "BUY",
            3,
            125,
            "2026-09-28"
        );

        const response = await injectAuthenticated({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/transactions`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual([
            expect.objectContaining({
                portfolio_id: portfolioId,
                security_id: securityId,
                type: "BUY",
                quantity: 3,
                price: 125,
                transaction_date: "2026-09-28",
            }),
        ]);
    });

    it("filters portfolio transactions by date range", async () => {
        service.create(
            portfolioId,
            securityId,
            "BUY",
            5,
            100,
            "2026-10-01"
        );

        service.create(
            portfolioId,
            securityId,
            "BUY",
            7,
            110,
            "2026-10-05"
        );

        const response = await injectAuthenticated({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/transactions?from=2026-10-02&to=2026-10-05`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    quantity: 7,
                    transaction_date: "2026-10-05",
                }),
            ])
        );

        expect(response.json()).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    quantity: 5,
                    transaction_date: "2026-10-01",
                }),
            ])
        );
    });

    it("rejects an invalid transaction date range", async () => {
        const response = await injectAuthenticated({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/transactions?from=2026-10-10&to=2026-10-05`,
        });

        expect(response.statusCode).toBe(400);

        expect(response.json()).toEqual({
            error: "Invalid date range",
        });
    });

    it("returns transactions for a specific security in a portfolio", async () => {
        service.create(
            portfolioId,
            securityId,
            "BUY",
            8,
            100,
            "2026-10-01"
        );

        const response = await injectAuthenticated({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/securities/${securityId}/transactions`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    portfolio_id: portfolioId,
                    security_id: securityId,
                    type: "BUY",
                    quantity: 8,
                    price: 100,
                    transaction_date: "2026-10-01",
                }),
            ])
        );
    });

    it("filters security transactions by date range", async () => {
        service.create(
            portfolioId,
            securityId,
            "BUY",
            6,
            100,
            "2026-10-01"
        );

        service.create(
            portfolioId,
            securityId,
            "BUY",
            9,
            110,
            "2026-10-05"
        );

        const response = await injectAuthenticated({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/securities/${securityId}/transactions?from=2026-10-02&to=2026-10-05`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    quantity: 9,
                    transaction_date: "2026-10-05",
                }),
            ])
        );

        expect(response.json()).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    quantity: 6,
                    transaction_date: "2026-10-01",
                }),
            ])
        );
    });

    it("rejects an invalid security transaction date range", async () => {
        const response = await injectAuthenticated({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/securities/${securityId}/transactions?from=2026-10-10&to=2026-10-05`,
        });

        expect(response.statusCode).toBe(400);

        expect(response.json()).toEqual({
            error: "Invalid date range",
        });
    });
    it("returns the holding for a security as of a date", async () => {
        const isolatedPortfolioId = Number(
            db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (?, ?)
        `).run(userId, "Holding As Of Portfolio").lastInsertRowid
        );

        service.create(
            isolatedPortfolioId,
            securityId,
            "BUY",
            10,
            100,
            "2026-10-01"
        );

        service.create(
            isolatedPortfolioId,
            securityId,
            "SELL",
            3,
            120,
            "2026-10-05"
        );

        const response = await injectAuthenticated({
            method: "GET",
            url: `/api/portfolios/${isolatedPortfolioId}/securities/${securityId}/holding?asOf=2026-10-03`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual({
            portfolio_id: isolatedPortfolioId,
            security_id: securityId,
            as_of: "2026-10-03",
            quantity: 10,
        });
    });

    it("returns the holding change for a security between two dates", async () => {
        const isolatedPortfolioId = Number(
            db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (?, ?)
        `).run(userId, "Holding Change Portfolio").lastInsertRowid
        );

        service.create(
            isolatedPortfolioId,
            securityId,
            "BUY",
            10,
            100,
            "2026-10-01"
        );

        service.create(
            isolatedPortfolioId,
            securityId,
            "BUY",
            5,
            110,
            "2026-10-05"
        );

        service.create(
            isolatedPortfolioId,
            securityId,
            "SELL",
            3,
            120,
            "2026-10-08"
        );

        const response = await injectAuthenticated({
            method: "GET",
            url: `/api/portfolios/${isolatedPortfolioId}/securities/${securityId}/holding/change?from=2026-10-02&to=2026-10-08`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual({
            portfolio_id: isolatedPortfolioId,
            security_id: securityId,
            from: "2026-10-02",
            to: "2026-10-08",
            quantity_change: 2,
        });
    });

    it("returns securities held in a portfolio as of a date", async () => {
        const isolatedPortfolioId = Number(
            db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (?, ?)
        `).run(userId, "Securities As Of Portfolio").lastInsertRowid
        );

        const secondSecurityId = Number(
            db.prepare(`
            INSERT INTO securities (name)
            VALUES (?)
        `).run("Second Route Security").lastInsertRowid
        );

        service.create(
            isolatedPortfolioId,
            securityId,
            "BUY",
            10,
            100,
            "2026-10-01"
        );

        service.create(
            isolatedPortfolioId,
            secondSecurityId,
            "BUY",
            5,
            200,
            "2026-10-05"
        );

        const response = await injectAuthenticated({
            method: "GET",
            url: `/api/portfolios/${isolatedPortfolioId}/securities?asOf=2026-10-03`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual([
            {
                security_id: securityId,
                quantity: 10,
            },
        ]);
    });

    it("prevents a user from creating a transaction in another user's portfolio", async () => {
        const result = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("Unauthorized Writer", "unauthorized-writer@example.com");

        const otherUserId = Number(result.lastInsertRowid);

        const response = await injectAuthenticated(
            {
                method: "POST",
                url: "/api/transactions",
                payload: {
                    portfolioId,
                    securityId,
                    type: "BUY",
                    quantity: 5,
                    price: 100,
                    transactionDate: "2026-10-17",
                },
            },
            otherUserId
        );

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Portfolio not found",
        });
    });

    it("prevents a user from retrieving another user's portfolio transactions", async () => {
        const result = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("Other Portfolio User", "other-portfolio@example.com");

        const otherUserId = Number(result.lastInsertRowid);

        const response = await injectAuthenticated(
            {
                method: "GET",
                url: `/api/portfolios/${portfolioId}/transactions`,
            },
            otherUserId
        );

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Portfolio not found",
        });
    });

    it("prevents a user from retrieving another user's portfolio holding", async () => {
        const result = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("Other Holding User", "other-holding@example.com");

        const otherUserId = Number(result.lastInsertRowid);

        const response = await injectAuthenticated(
            {
                method: "GET",
                url: `/api/portfolios/${portfolioId}/securities/${securityId}/holding?asOf=2026-10-01`,
            },
            otherUserId
        );

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Portfolio not found",
        });
    });

    it("prevents a user from retrieving another user's portfolio holding changes between 2 dates", async () => {
        const result = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("Other Holding User 2", "other-holding2@example.com");

        const otherUserId = Number(result.lastInsertRowid);

        const response = await injectAuthenticated(
            {
                method: "GET",
                url: `/api/portfolios/${portfolioId}/securities/${securityId}/holding/change?from=2026-09-01&to=2026-09-30`,
            },
            otherUserId
        );

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Portfolio not found",
        });
    });

    // Additional tests for other routes can be added here
    it("prevents a user from retrieving another user's portfolio security transactions", async () => {
        const result = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("Other Transactions User", "other-transactions@example.com");

        const otherUserId = Number(result.lastInsertRowid);

        const response = await injectAuthenticated(
            {
                method: "GET",
                url: `/api/portfolios/${portfolioId}/securities/${securityId}/transactions`,
            },
            otherUserId
        );

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Portfolio not found",
        });
    });
    //GET /api/portfolios/:portfolioId/securities?asOf=2026-10-01
    it("prevents a user from retrieving another user's portfolio securities as of a specific date", async () => {
        const result = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("Other Securities User", "other-securities@example.com");

        const otherUserId = Number(result.lastInsertRowid);

        const response = await injectAuthenticated(
            {
                method: "GET",
                url: `/api/portfolios/${portfolioId}/securities?asOf=2026-10-01`,
            },
            otherUserId
        );

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Portfolio not found",
        });
    });


    it("rejects an unauthenticated CSV import", async () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
        ].join("\n");

        const response = await app.inject({
            method: "POST",
            url: `/api/portfolios/${portfolioId}/transactions/import`,
            payload: { csv },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({
            error: "Authentication required",
        });
        expect(
            db.prepare("SELECT COUNT(*) AS count FROM transactions").get()
        ).toEqual({ count: 0 });
    });



    it("prevents a user from importing transactions into another user's portfolio", async () => {
        const result = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("Other Import User", "other-import@example.com");

        const otherUserId = Number(result.lastInsertRowid);
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
        ].join("\n");

        const response = await injectAuthenticated(
            {
                method: "POST",
                url: `/api/portfolios/${portfolioId}/transactions/import`,
                payload: { csv },
            },
            otherUserId
        );

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Portfolio not found",
        });
        expect(
            db.prepare("SELECT COUNT(*) AS count FROM transactions").get()
        ).toEqual({ count: 0 });
    });

    it("allows an authorized user to import valid CSV through the API", async () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
            `2026-10-03,${securityId},BUY,5,2550`,
        ].join("\n");

        const response = await injectAuthenticated({
            method: "POST",
            url: `/api/portfolios/${portfolioId}/transactions/import`,
            payload: { csv },
        });

        expect(response.statusCode).toBe(201);

        expect(response.json()).toMatchObject({
            importedCount: 2,
        });

        const transactions = (
            db.prepare(`
    SELECT id, security_id, type, quantity, price, transaction_date
    FROM transactions
    WHERE portfolio_id = ?
    ORDER BY transaction_date, id
  `).all(portfolioId) as {
                id: number;
                security_id: number;
                type: string;
                quantity: number;
                price: number | null;
                transaction_date: string;
            }[]
        );

        expect(
            transactions.map(
                ({ security_id, type, quantity, price, transaction_date }) => ({
                    security_id,
                    type,
                    quantity,
                    price,
                    transaction_date,
                })
            )
        ).toEqual([
            {
                security_id: securityId,
                type: "BUY",
                quantity: 10,
                price: 2500,
                transaction_date: "2026-10-01",
            },
            {
                security_id: securityId,
                type: "BUY",
                quantity: 5,
                price: 2550,
                transaction_date: "2026-10-03",
            },
        ]);



        const holding = db.prepare(`
        SELECT quantity
        FROM holdings
        WHERE portfolio_id = ? AND security_id = ?
    `).get(portfolioId, securityId);

        expect(holding).toEqual({ quantity: 15 });
    });


});