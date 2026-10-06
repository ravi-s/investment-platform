import Fastify, { type FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { transactionRoutes } from "../routes/transaction.js";
import { runMigrations } from "../db/migration-runner.ts";
import { TransactionService } from "../services/transaction.js";

describe("Transaction routes", () => {
    let app: FastifyInstance;
    let db: Database.Database;
    let service: TransactionService;
    let portfolioId: number;
    let securityId: number;

    beforeAll(async () => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Route User", "route@example.com");

        portfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Route Portfolio").lastInsertRowid
        );

        securityId = Number(
            db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Route Security").lastInsertRowid
        );

        service = new TransactionService(db);

        app = Fastify();

        await app.register(transactionRoutes, { service });
    });

    afterAll(async () => {
        await app.close();
        db.close();
    });

    it("creates a BUY transaction through the API", async () => {
        const response = await app.inject({
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
        const response = await app.inject({
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

    it("retrieves a SPLIT transaction by ID through the API", async () => {
        const split = service.createSplit(
            portfolioId,
            securityId,
            2,
            1,
            "2026-09-30"
        ) as { id: number };

        const response = await app.inject({
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

    it("returns 404 when retrieving a transaction that does not exist", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/transactions/999999",
        });

        expect(response.statusCode).toBe(404);

        expect(response.json()).toEqual({
            error: "Transaction not found",
        });
    });
    it("rejects a SPLIT with an invalid numerator", async () => {
        const response = await app.inject({
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
        const response = await app.inject({
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
        const response = await app.inject({
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
        const response = await app.inject({
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
        const response = await app.inject({
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
        const response = await app.inject({
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

        const response = await app.inject({
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
        `).run(1, "Insufficient Sell Portfolio").lastInsertRowid
        );

        service.create(
            isolatedPortfolioId,
            securityId,
            "BUY",
            10,
            100,
            "2026-09-29"
        );

        const response = await app.inject({
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
        const response = await app.inject({
            method: "GET",
            url: `/api/portfolios/${portfolioId}/transactions`,
        });

        expect(response.statusCode).toBe(200);

        expect(response.json()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    portfolio_id: portfolioId,
                    security_id: securityId,
                    type: "BUY",
                }),
            ])
        );
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

        const response = await app.inject({
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
        const response = await app.inject({
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

        const response = await app.inject({
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

        const response = await app.inject({
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
        const response = await app.inject({
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
        `).run(1, "Holding As Of Portfolio").lastInsertRowid
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

        const response = await app.inject({
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
        `).run(1, "Holding Change Portfolio").lastInsertRowid
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

        const response = await app.inject({
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
        `).run(1, "Securities As Of Portfolio").lastInsertRowid
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

        const response = await app.inject({
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


});