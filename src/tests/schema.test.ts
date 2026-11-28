import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../db/migration-runner.js";

const mutualFundIsins = [
    "INF846K01CX4",
    "INF754K01EA4",
    "INF179KB1HU9",
    "INF179K01YM7",
    "INF109K012B0",
    "INF109K01W82",
    "INF174K01JI7",
    "INF769K01EK1",
    "INF247L01AG2",
    "INF879O01027",
];

describe("Migration 019: asset types and mutual fund NAVs", () => {
    let testDb: Database.Database;

    beforeAll(() => {
        testDb = new Database(":memory:");
        testDb.pragma("foreign_keys = ON");

        runMigrations(testDb);
    });

    afterAll(() => {
        testDb.close();
    });

    it("classifies all ten existing mutual fund securities as MUTUAL_FUND", () => {
        const securities = testDb
            .prepare(`
                SELECT isin, asset_type
                FROM securities
                WHERE isin IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ORDER BY isin
            `)
            .all(...mutualFundIsins) as Array<{
            isin: string;
            asset_type: string;
        }>;

        expect(securities).toHaveLength(10);
        expect(securities).toEqual(
            [...mutualFundIsins]
                .sort()
                .map((isin) => ({ isin, asset_type: "MUTUAL_FUND" })),
        );
    });

    it("rejects an unsupported asset type", () => {
        const insertInvalidAssetType = () => {
            testDb
                .prepare(`
                    INSERT INTO securities (name, isin, asset_type)
                    VALUES (?, ?, ?)
                `)
                .run("Invalid Asset Type Security", "TESTINVALID0001", "CRYPTO");
        };

        expect(insertInvalidAssetType).toThrow(/CHECK constraint failed/);
    });
});