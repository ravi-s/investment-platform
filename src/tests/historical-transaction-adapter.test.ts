
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runMigrations } from "../db/migration-runner.js";
import { SecurityRepository } from "../repositories/security.js";
import { ZerodhaTransactionAdapter } from "../services/zerodha-transactional-adapter.ts";

describe("HistoricalTransactionAdapter", () => {
    let testDb: Database.Database;
    let securityId: number;
    let adapter: ZerodhaTransactionAdapter;

    beforeEach(() => {
        testDb = new Database(":memory:");
        testDb.pragma("foreign_keys = ON");
        runMigrations(testDb);

        const securityRepository = new SecurityRepository(testDb);

        const security = securityRepository.findByIsin(
            "INF846K01CX4"
        );


        if (!security) {
            throw new Error("Test security not found: INF846K01CX4");
        }
        securityId = security.id;


        adapter = new ZerodhaTransactionAdapter(
            securityRepository
        );
    });

    afterEach(() => {
        testDb.close();
    });

    it("maps historical rows by ISIN and preserves transaction provenance", () => {
        const csv = [
            "isin,trade_date,trade_type,quantity,price,trade_id,order_id,source_file,source_row_number,signed_units,validation_flag",
            "INF846K01CX4,2026-05-05,buy,10.5,25.1234,10001,20001,2026-tilldate.csv,14,10.5,MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
            "INF846K01CX4,2026-05-05,buy,10.5,25.1234,10002,20002,2026-tilldate.csv,15,10.5,MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
        ].join("\n");

        const rows = adapter.adapt(csv);

        expect(rows).toHaveLength(2);
        expect(rows).toEqual([
            {
                sourceRow: 2,
                transactionDate: "2026-05-05",
                securityId,
                type: "BUY",
                quantity: 10.5,
                price: 25.1234,
                sourceFile: "2026-tilldate.csv",
                sourceRowNumber: 14,
                isin: "INF846K01CX4",
                tradeId: "10001",
                orderId: "20001",
            },
            {
                sourceRow: 3,
                transactionDate: "2026-05-05",
                securityId,
                type: "BUY",
                quantity: 10.5,
                price: 25.1234,
                sourceFile: "2026-tilldate.csv",
                sourceRowNumber: 15,
                isin: "INF846K01CX4",
                tradeId: "10002",
                orderId: "20002",
            },
        ]);
    });

    it("accepts rows where broker identifiers are absent", () => {
        const csv = [
            "isin,trade_date,trade_type,quantity,price,trade_id,order_id,source_file,source_row_number,signed_units,validation_flag",
            "INF846K01CX4,2026-05-06,sell,2,26.5,,,2019.csv,8,-2,CURRENT_HOLDINGS_ISIN",
        ].join("\n");

        const rows = adapter.adapt(csv);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            securityId,
            type: "SELL",
            tradeId: null,
            orderId: null,
            sourceFile: "2019.csv",
            sourceRowNumber: 8,
        });
    });

    it("rejects an ISIN that has no matching security", () => {
        const csv = [
            "isin,trade_date,trade_type,quantity,price,trade_id,order_id,source_file,source_row_number,signed_units,validation_flag",
            "INF000000000,2026-05-05,buy,10,25,10001,20001,2019.csv,8,10,MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
        ].join("\n");

        expect(() => adapter.adapt(csv)).toThrow(/ISIN/i);
    });

    it("accepts all validation flags present in the consolidated dataset", () => {
        const csv = [
            "isin,trade_date,trade_type,quantity,price,trade_id,order_id,source_file,source_row_number,signed_units,validation_flag",
            "INF846K01CX4,2026-05-05,buy,10,25,10001,20001,2019.csv,8,10,MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
            "INF846K01CX4,2026-05-06,sell,2,26,10002,20002,2019.csv,9,-2,COMPLETE_CALENDAR_YEAR_EXPORT",
            "INF846K01CX4,2026-05-07,buy,5,27,10003,20003,2026.csv,10,5,CURRENT_HOLDINGS_ISIN",
        ].join("\n");

        expect(adapter.adapt(csv)).toHaveLength(3);
    });

    it("rejects signed units with an incorrect sign", () => {
        const csv = [
            "isin,trade_date,trade_type,quantity,price,trade_id,order_id,source_file,source_row_number,signed_units,validation_flag",
            "INF846K01CX4,2026-05-05,buy,10,25,10001,20001,2019.csv,8,-10,MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
        ].join("\n");

        expect(() => adapter.adapt(csv)).toThrow(/signed_units/i);
    });

    it("rejects signed units that do not match the transaction quantity", () => {
        const csv = [
            "isin,trade_date,trade_type,quantity,price,trade_id,order_id,source_file,source_row_number,signed_units,validation_flag",
            "INF846K01CX4,2026-05-05,buy,10,25,10001,20001,2019.csv,8,9,MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
        ].join("\n");

        expect(() => adapter.adapt(csv)).toThrow(/signed_units/i);
    });

    it("rejects an unrecognized validation flag", () => {
        const csv = [
            "isin,trade_date,trade_type,quantity,price,trade_id,order_id,source_file,source_row_number,signed_units,validation_flag",
            "INF846K01CX4,2026-05-05,buy,10,25,10001,20001,2019.csv,8,10,UNKNOWN_FLAG",
        ].join("\n");

        expect(() => adapter.adapt(csv)).toThrow(/validation_flag/i);
    });


    it("adapts the complete consolidated historical dataset", () => {
        const csvPath = resolve(
            process.cwd(),
            "src/tests/fixtures/consolidated_current_holdings_transactions_2018_2026.csv"
        );

        const csv = readFileSync(csvPath, "utf-8");

        const rows = adapter.adapt(csv);

        // Total transaction count
        expect(rows).toHaveLength(477);

        // Transaction type distribution
        expect(rows.filter(row => row.type === "BUY")).toHaveLength(396);
        expect(rows.filter(row => row.type === "SELL")).toHaveLength(81);

        // All ten currently held schemes must be mapped.
        expect(new Set(rows.map(row => row.isin)).size).toBe(10);

        // Every consolidated CSV row must retain its source position.
        expect(rows.map(row => row.sourceRow)).toEqual(
            Array.from({ length: 477 }, (_, index) => index + 2)
        );

        // Both distinct ICICI purchases on May 5 must be retained.
        const iciciPurchases = rows.filter(row =>
            row.isin === "INF109K01W82" &&
            row.transactionDate === "2026-05-05" &&
            row.type === "BUY" &&
            row.quantity === 71.157 &&
            row.price === 70.2634
        );

        expect(iciciPurchases).toHaveLength(2);
    });
});
