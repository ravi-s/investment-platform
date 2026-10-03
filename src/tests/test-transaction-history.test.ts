import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.ts";
import { TransactionService } from "../services/transaction.ts";

describe("TransactionService history", () => {
    let db: Database.Database;
    let transactionService: TransactionService;
    let portfolioId: number;
    let relianceId: number;
    let tcsId: number;

    beforeAll(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");
        runMigrations(db);

        db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Test User", "transaction-history@example.com");

        portfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Test Portfolio").lastInsertRowid
        );

        relianceId = Number(
            db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Reliance Industries Limited").lastInsertRowid
        );

        tcsId = Number(
            db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Tata Consultancy Services Limited").lastInsertRowid
        );

        transactionService = new TransactionService(db);

        transactionService.create(
            portfolioId,
            relianceId,
            "BUY",
            10,
            100,
            "2026-09-21"
        );
        transactionService.create(
            portfolioId,
            relianceId,
            "BUY",
            5,
            110,
            "2026-09-22"
        );
        transactionService.create(
            portfolioId,
            relianceId,
            "SELL",
            3,
            120,
            "2026-09-23"
        );
        transactionService.create(
            portfolioId,
            tcsId,
            "BUY",
            4,
            200,
            "2026-09-22"
        );
        transactionService.create(
            portfolioId,
            tcsId,
            "SELL",
            1,
            210,
            "2026-09-23"
        );
    });

    afterAll(() => {
        db.close();
    });

    it("reconstructs the holding as of each requested date", () => {
        expect(
            transactionService.getHoldingAsOf(
                portfolioId,
                relianceId,
                "2026-09-21"
            )
        ).toBe(10);
        expect(
            transactionService.getHoldingAsOf(
                portfolioId,
                relianceId,
                "2026-09-22"
            )
        ).toBe(15);
        expect(
            transactionService.getHoldingAsOf(
                portfolioId,
                relianceId,
                "2026-09-23"
            )
        ).toBe(12);
    });

    it("calculates the net holding change across an inclusive date range", () => {
        expect(
            transactionService.getHoldingChange(
                portfolioId,
                relianceId,
                "2026-09-22",
                "2026-09-23"
            )
        ).toBe(2);
    });

    it("filters a security's transactions by date", () => {
        expect(
            transactionService.findTransactionsForSecurity(
                portfolioId,
                relianceId,
                "2026-09-23",
                "2026-09-23"
            )
        ).toMatchObject([
            {
                portfolio_id: portfolioId,
                security_id: relianceId,
                type: "SELL",
                quantity: 3,
                price: 120,
                transaction_date: "2026-09-23",
            },
        ]);

        expect(
            transactionService.findTransactionsForSecurity(
                portfolioId,
                tcsId,
                "2026-09-22",
                "2026-09-23"
            )
        ).toMatchObject([
            {
                portfolio_id: portfolioId,
                security_id: tcsId,
                type: "SELL",
                quantity: 1,
                price: 210,
                transaction_date: "2026-09-23",
            },
            {
                portfolio_id: portfolioId,
                security_id: tcsId,
                type: "BUY",
                quantity: 4,
                price: 200,
                transaction_date: "2026-09-22",
            },
        ]);
    });

    it("returns only securities with positive holdings as of each date", () => {
        expect(
            transactionService.findSecuritiesHeldAsOf(
                portfolioId,
                "2026-09-21"
            )
        ).toEqual([{ security_id: relianceId, quantity: 10 }]);

        expect(
            transactionService.findSecuritiesHeldAsOf(
                portfolioId,
                "2026-09-22"
            )
        ).toEqual([
            { security_id: relianceId, quantity: 15 },
            { security_id: tcsId, quantity: 4 },
        ]);

        expect(
            transactionService.findSecuritiesHeldAsOf(
                portfolioId,
                "2026-09-23"
            )
        ).toEqual([
            { security_id: relianceId, quantity: 12 },
            { security_id: tcsId, quantity: 3 },
        ]);
    });

    it("returns portfolio composition as of the requested date", () => {
        expect(
            transactionService.getPortfolioCompositionAsOf(
                portfolioId,
                "2026-09-23"
            )
        ).toEqual([
            {
                security_id: relianceId,
                quantity: 12,
                acquisition_amount: 1550,
            },
            {
                security_id: tcsId,
                quantity: 3,
                acquisition_amount: 800,
            },
        ]);
    });
});
