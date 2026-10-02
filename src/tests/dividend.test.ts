
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";

import { runMigrations } from "../db/migration-runner.ts";
import { TransactionService } from "../services/transaction.js";
import { DividendService } from "../services/dividend.js";

describe("DividendService", () => {
    let db: Database.Database;
    let transactionService: TransactionService;
    let dividendService: DividendService;

    beforeAll(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        // Reference data required by TransactionService.
        db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Test User", "test@example.com");

        db.prepare(`
            INSERT INTO portfolios (user_id, name)
            VALUES (?, ?)
        `).run(1, "Test Portfolio");

        db.prepare(`
            INSERT INTO securities (name)
            VALUES (?)
        `).run("Test Security");

        transactionService = new TransactionService(db);
        dividendService = new DividendService();
    });

    afterAll(() => {
        db.close();
    });

    it("calculates dividend income from eligible quantity", () => {
        const result = dividendService.calculate({
            eligibleQuantity: 70,
            amountPerUnit: 10,
        });

        expect(result).toBe(700);
    });

    it("calculates dividend income using the holding on the record date", () => {
        transactionService.create(
            1,
            1,
            "BUY",
            100,
            2000,
            "2026-09-01"
        );

        transactionService.create(
            1,
            1,
            "SELL",
            30,
            2200,
            "2026-09-10"
        );

        const eligibleQuantity = transactionService.getHoldingAsOf(
            1,
            1,
            "2026-09-15"
        );

        expect(eligibleQuantity).toBe(70);

        const result = dividendService.calculate({
            eligibleQuantity,
            amountPerUnit: 10,
        });

        expect(result).toBe(700);
    });
});

