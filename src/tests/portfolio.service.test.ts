import Database from "better-sqlite3";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runMigrations } from "../db/migration-runner.js";
import { PortfolioService } from "../services/portfolio.js";
import { TransactionService } from "../services/transaction.js";
import { MarketPriceService } from "../services/market-price.js";

describe("PortfolioService", () => {
    let testDb: Database.Database;
    let portfolioService: PortfolioService;

    beforeAll(() => {
        testDb = new Database(":memory:");
        testDb.pragma("foreign_keys = ON");

        runMigrations(testDb);

        testDb
            .prepare(`
                INSERT INTO users (name, email)
                VALUES ('Test User', 'test-user@example.com')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (1, 'Test Portfolio')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (1, 'Test Portfolio Without Prices')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (1, 'Test Portfolio Without Listing')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (1, 'Test Portfolio With Two Holdings')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (1, 'Test Portfolio With Date Boundary Transactions')
            `)
            .run();

        const security = testDb
            .prepare(`
                INSERT INTO securities (name)
                VALUES ('Reliance Industries Limited')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO listings (security_id, exchange_id, symbol)
                VALUES (?, 1, 'RELIANCE')
            `)
            .run(security.lastInsertRowid);

        const transactionService = new TransactionService(testDb);

        transactionService.create(
            1,
            Number(security.lastInsertRowid),
            "BUY",
            102,
            2500,
            "2026-09-22"
        );

        transactionService.create(
            1,
            Number(security.lastInsertRowid),
            "SELL",
            2,
            2500,
            "2026-09-23"
        );

        const marketPriceService = new MarketPriceService(testDb);

        marketPriceService.create(
            "NSE",
            "RELIANCE",
            "2026-09-23",
            2650
        );

        const noPriceSecurity = testDb
            .prepare(`
                INSERT INTO securities (name)
                VALUES ('Tata Consultancy Services Limited')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO listings (security_id, exchange_id, symbol)
                VALUES (?, 1, 'TCS')
            `)
            .run(noPriceSecurity.lastInsertRowid);

        transactionService.create(
            2,
            Number(noPriceSecurity.lastInsertRowid),
            "BUY",
            10,
            3500,
            "2026-09-22"
        );

        const noListingSecurity = testDb
            .prepare(`
                INSERT INTO securities (name)
                VALUES ('Infosys Limited')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO listings (security_id, exchange_id, symbol)
                VALUES (?, 2, 'INFY')
            `)
            .run(noListingSecurity.lastInsertRowid);

        transactionService.create(
            3,
            Number(noListingSecurity.lastInsertRowid),
            "BUY",
            5,
            1500,
            "2026-09-22"
        );

        const hdfcSecurity = testDb
            .prepare(`
                INSERT INTO securities (name)
                VALUES ('HDFC Bank Limited')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO listings (security_id, exchange_id, symbol)
                VALUES (?, 1, 'HDFCBANK')
            `)
            .run(hdfcSecurity.lastInsertRowid);

        transactionService.create(
            4,
            Number(hdfcSecurity.lastInsertRowid),
            "BUY",
            20,
            1550,
            "2026-09-22"
        );

        marketPriceService.create(
            "NSE",
            "HDFCBANK",
            "2026-09-23",
            1600
        );

        const iciciSecurity = testDb
            .prepare(`
                INSERT INTO securities (name)
                VALUES ('ICICI Bank Limited')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO listings (security_id, exchange_id, symbol)
                VALUES (?, 1, 'ICICIBANK')
            `)
            .run(iciciSecurity.lastInsertRowid);

        transactionService.create(
            4,
            Number(iciciSecurity.lastInsertRowid),
            "BUY",
            15,
            1150,
            "2026-09-22"
        );

        marketPriceService.create(
            "NSE",
            "ICICIBANK",
            "2026-09-23",
            1200
        );

        const wiproSecurity = testDb
            .prepare(`
                INSERT INTO securities (name)
                VALUES ('Wipro Limited')
            `)
            .run();

        testDb
            .prepare(`
                INSERT INTO listings (security_id, exchange_id, symbol)
                VALUES (?, 1, 'WIPRO')
            `)
            .run(wiproSecurity.lastInsertRowid);

        // Included: dated on the valuation date itself.
        transactionService.create(
            5,
            Number(wiproSecurity.lastInsertRowid),
            "BUY",
            30,
            450,
            "2026-09-23"
        );

        // Excluded: dated after the valuation date.
        transactionService.create(
            5,
            Number(wiproSecurity.lastInsertRowid),
            "BUY",
            50,
            460,
            "2026-09-24"
        );

        marketPriceService.create(
            "NSE",
            "WIPRO",
            "2026-09-23",
            500
        );

        portfolioService = new PortfolioService(testDb);
    });

    afterAll(() => {
        testDb.close();
    });

    it("calculates portfolio valuation as of a date", () => {
        const result = portfolioService.getPortfolioValuation(
            1,
            "2026-09-23",
            "NSE"
        );

        expect(result.total_market_value).toBe(265000);
    });

    it("uses the net quantity after a SELL transaction rather than the original buy quantity", () => {
        const result = portfolioService.getPortfolioValuation(
            1,
            "2026-09-23",
            "NSE"
        );

        expect(result.positions[0]?.quantity).toBe(100);
        expect(result.total_market_value).toBe(100 * 2650);
    });

    it("throws when a held security has no historical price for the requested date", () => {
        expect(() =>
            portfolioService.getPortfolioValuation(
                2,
                "2026-09-23",
                "NSE"
            )
        ).toThrow(/Historical price not found for listing \d+ on 2026-09-23/);
    });

    it("throws when a held security has no listing on the requested exchange", () => {
        expect(() =>
            portfolioService.getPortfolioValuation(
                3,
                "2026-09-23",
                "NSE"
            )
        ).toThrow(/Listing not found for security \d+ on NSE/);
    });

    it("aggregates market value across multiple priced holdings", () => {
        const result = portfolioService.getPortfolioValuation(
            4,
            "2026-09-23",
            "NSE"
        );

        expect(result.positions.length).toBe(2);
        expect(result.total_market_value).toBe(20 * 1600 + 15 * 1200);
    });

    it("includes a transaction on the valuation date and excludes one after it", () => {
        const result = portfolioService.getPortfolioValuation(
            5,
            "2026-09-23",
            "NSE"
        );

        expect(result.positions[0]?.quantity).toBe(30);
        expect(result.total_market_value).toBe(30 * 500);
    });
});