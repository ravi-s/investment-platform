import Fastify, { type FastifyInstance } from "fastify";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { transactionRoutes } from "../routes/transaction.js";
import { runMigrations } from "../db/migration-runner.ts";
import { TransactionService } from "../services/transaction.js";

describe("Transaction routes", () => {
    let app: FastifyInstance;
    let db: Database.Database;
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

        const service = new TransactionService(db);

        app = Fastify();

        await transactionRoutes(app, service);
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
});