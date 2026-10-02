
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";

import { runMigrations } from "../db/migration-runner.ts";
import { InvestmentEventRepository } from "../repositories/investment-event.js";
import { TransactionService } from "../services/transaction.js";
import { DividendService } from "../services/dividend.js";
import { InvestmentEventService } from "../services/investment-event.js";

describe("DividendService", () => {
    let db: Database.Database;
    let transactionService: TransactionService;
    let dividendService: DividendService;
    let event:
        | {
            id: number;
            security_id: number;
            event_type: "DIVIDEND";
            ex_date: string;
            record_date: string;
            payment_date: string;
            amount_per_unit: number;
            currency: string;
        }
        | undefined;

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

        const eventRepository = new InvestmentEventRepository(db);

        event = eventRepository.create(
            1,
            "DIVIDEND",
            "2026-09-10",
            "2026-09-11",
            "2026-09-25",
            10,
            "INR"
        );
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

    it("calculates dividend income using the holding on the investment event record date", () => {
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

        if (!event) {
            throw new Error("Investment event was not created");
        }

        const eligibleQuantity = transactionService.getHoldingAsOf(
            1,
            1,
            event.record_date
        );

        expect(eligibleQuantity).toBe(70);

        const result = dividendService.calculate({
            eligibleQuantity,
            amountPerUnit: event.amount_per_unit,
        });

        expect(result).toBe(700);
    });

    it("calculates dividend income for a portfolio from an investment event", () => {
        const investmentEventService = new InvestmentEventService(
            new InvestmentEventRepository(db),
            transactionService,
            dividendService
        );

        if (!event) {
            throw new Error("Investment event was not created");
        }

        const result = investmentEventService.calculateDividendIncome({
            portfolioId: 1,
            investmentEventId: event.id,
        });

        expect(result).toBe(700);
    });
});

