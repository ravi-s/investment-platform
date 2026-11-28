import Database from "better-sqlite3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../db/migration-runner.js";

describe("Mutual fund NAV repository constraints", () => {
    let testDb: Database.Database;
    let securityId: number;

    beforeAll(() => {
        testDb = new Database(":memory:");
        testDb.pragma("foreign_keys = ON");

        runMigrations(testDb);

        const security = testDb
            .prepare(`
                INSERT INTO securities (name, isin, asset_type)
                VALUES (?, ?, ?)
            `)
            .run("Test Mutual Fund", "TESTMF0000001", "MUTUAL_FUND");

        securityId = Number(security.lastInsertRowid);
    });

    afterAll(() => {
        testDb.close();
    });

    beforeEach(() => {
        testDb.prepare("DELETE FROM mutual_fund_navs").run();
    });

    const insertNav = (navDate: string, nav: number) =>
        testDb
            .prepare(`
                INSERT INTO mutual_fund_navs (
                    security_id,
                    nav_date,
                    nav,
                    source,
                    fetched_at
                )
                VALUES (?, ?, ?, ?, ?)
            `)
            .run(securityId, navDate, nav, "test", "2026-01-01T00:00:00.000Z");

    it("accepts positive NAV values", () => {
        expect(() => insertNav("2026-01-01", 1.25)).not.toThrow();
    });

    it.each([0, -1])("rejects a NAV value of %s", (nav) => {
        expect(() => insertNav(`2026-01-${nav === 0 ? "02" : "03"}`, nav)).toThrow();
    });

    it("rejects duplicate entries for the same security and NAV date", () => {
        insertNav("2026-02-01", 10.5);

        expect(() => insertNav("2026-02-01", 11.5)).toThrow();
    });

    it("accepts multiple NAV dates for the same security", () => {
        insertNav("2026-03-01", 12.5);
        insertNav("2026-03-02", 13.5);

        const entries = testDb
            .prepare(`
                SELECT nav_date, nav
                FROM mutual_fund_navs
                WHERE security_id = ?
                ORDER BY nav_date
            `)
            .all(securityId) as Array<{ nav_date: string; nav: number }>;

        expect(entries).toEqual([
            { nav_date: "2026-03-01", nav: 12.5 },
            { nav_date: "2026-03-02", nav: 13.5 },
        ]);
    });
});