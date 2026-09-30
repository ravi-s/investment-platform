import Database from "better-sqlite3";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runMigrations } from "../db/migration-runner.js";
import { MarketPriceService } from "../services/market-price.js";

describe("MarketPriceService", () => {
    let testDb: Database.Database;
    let service: MarketPriceService;

    beforeAll(() => {
        testDb = new Database(":memory:");
        testDb.pragma("foreign_keys = ON");

        runMigrations(testDb);

        const security = testDb
            .prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `)
            .run("Reliance Industries Limited");

        testDb
            .prepare(`
                INSERT INTO listings (
                    security_id,
                    exchange_id,
                    symbol
                )
                VALUES (?, ?, ?)
            `)
            .run(
                security.lastInsertRowid,
                1,
                "RELIANCE"
            );

        service = new MarketPriceService(testDb);
    });

    afterAll(() => {
        testDb.close();
    });

    it("creates a market price", () => {
        const result = service.create(
            "NSE",
            "RELIANCE",
            "2026-09-23",
            2650
        );

        expect(result).toBeDefined();
        expect(result.close_price).toBe(2650);
    });

    it("retrieves a market price by listing and date", () => {
        const result = service.findByListingAndDate(
            "NSE",
            "RELIANCE",
            "2026-09-23"
        );

        expect(result).toBeDefined();
        expect(result?.close_price).toBe(2650);
    });

    it("rejects a duplicate market price for the same listing and date", () => {
        expect(() =>
            service.create(
                "NSE",
                "RELIANCE",
                "2026-09-23",
                2655
            )
        ).toThrow();
    });

    it("rejects a non-positive close price", () => {
        expect(() =>
            service.create(
                "NSE",
                "RELIANCE",
                "2026-09-24",
                0
            )
        ).toThrow();
    });

});