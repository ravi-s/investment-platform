import { readFile } from "node:fs/promises";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.js";
import { TransactionImportService } from "../services/transaction-import-service.js";

describe("Transaction CSV import", () => {
    let db: Database.Database;
    let portfolioId: number;
    let securityId: number;
    let importService: TransactionImportService;

    beforeEach(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Import Test User", "transaction-import@example.com");

        portfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Import Test Portfolio").lastInsertRowid
        );

        securityId = Number(
            db.prepare(`
        INSERT INTO securities (name)
        VALUES (?)
    `).run("Import Test Security").lastInsertRowid
        );

        importService = new TransactionImportService(db);
    });

    afterEach(() => {
        db.close();
    });

    it("imports two valid BUY rows from a CSV file", async () => {
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

        await importService.importCsv(portfolioId, csv);

        const transactions = db.prepare(`
            SELECT security_id, type, quantity, price, transaction_date
            FROM transactions
            WHERE portfolio_id = ?
            ORDER BY transaction_date
        `).all(portfolioId);

        expect(transactions).toEqual([
            {
                security_id: securityId,
                type: "BUY",
                quantity: 10,
                price: 2500,
                transaction_date: "2026-10-01",
            },
            {
                security_id: securityId,
                type: "BUY",
                quantity: 5,
                price: 2550,
                transaction_date: "2026-10-03",
            },
        ]);

        const holding = db.prepare(`
            SELECT quantity
            FROM holdings
            WHERE portfolio_id = ?
        `).get(portfolioId);

        expect(holding).toEqual({ quantity: 15 });
    });

    it("leaves the database unchanged when a valid row is followed by an invalid row", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
            `2026-10-03,${securityId},SELL,11,2550`,
        ].join("\n");

        expect(() => importService.importCsv(portfolioId, csv)).toThrow(
            "Insufficient holding"
        );

        const transactions = db.prepare(`
            SELECT id
            FROM transactions
            WHERE portfolio_id = ?
        `).all(portfolioId);
        const holdings = db.prepare(`
            SELECT id, quantity
            FROM holdings
            WHERE portfolio_id = ?
        `).all(portfolioId);

        expect(transactions).toEqual([]);
        expect(holdings).toEqual([]);
    });

    it("leaves the database unchanged when the second CSV row is missing a required value", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
            `2026-10-03,${securityId},BUY,,2550`,
        ].join("\n");

        expect(() => importService.importCsv(portfolioId, csv)).toThrow(
            "Invalid CSV row 3: quantity is required"
        );

        const transactions = db.prepare(`
            SELECT id
            FROM transactions
            WHERE portfolio_id = ?
        `).all(portfolioId);
        const holdings = db.prepare(`
            SELECT id, quantity
            FROM holdings
            WHERE portfolio_id = ?
        `).all(portfolioId);

        expect(transactions).toEqual([]);
        expect(holdings).toEqual([]);
    });

    it("imports correctly when CSV columns are reordered", () => {
        const csv = [
            "price,type,transactionDate,quantity,securityId",
            `2500,BUY,2026-10-01,10,${securityId}`,
        ].join("\n");

        importService.importCsv(portfolioId, csv);

        const transactions = db.prepare(`
            SELECT security_id, type, quantity, price, transaction_date
            FROM transactions
            WHERE portfolio_id = ?
        `).all(portfolioId);

        expect(transactions).toEqual([
            {
                security_id: securityId,
                type: "BUY",
                quantity: 10,
                price: 2500,
                transaction_date: "2026-10-01",
            },
        ]);
    });

    it("returns no transactions for a header-only CSV", () => {
        const csv = "transactionDate,securityId,type,quantity,price";

        expect(importService.importCsv(portfolioId, csv)).toEqual([]);

        const transactions = db.prepare(`
            SELECT id
            FROM transactions
            WHERE portfolio_id = ?
        `).all(portfolioId);
        const holdings = db.prepare(`
            SELECT id
            FROM holdings
            WHERE portfolio_id = ?
        `).all(portfolioId);

        expect(transactions).toEqual([]);
        expect(holdings).toEqual([]);
    });

    it("rejects a whitespace-only record instead of silently ignoring it", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            "   ",
        ].join("\n");

        expect(() => importService.importCsv(portfolioId, csv)).toThrow(
            "Invalid Record Length: expect 5, got 1 on line 2"
        );

        const transactions = db.prepare(`
            SELECT id
            FROM transactions
            WHERE portfolio_id = ?
        `).all(portfolioId);
        const holdings = db.prepare(`
            SELECT id
            FROM holdings
            WHERE portfolio_id = ?
        `).all(portfolioId);

        expect(transactions).toEqual([]);
        expect(holdings).toEqual([]);
    });

    it("rejects a delimiter-only record because required values are missing", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            ",,,,",
        ].join("\n");

        expect(() => importService.importCsv(portfolioId, csv)).toThrow(
            "Invalid CSV row 2: transactionDate is required"
        );

        const transactions = db.prepare(`
            SELECT id
            FROM transactions
            WHERE portfolio_id = ?
        `).all(portfolioId);
        const holdings = db.prepare(`
            SELECT id
            FROM holdings
            WHERE portfolio_id = ?
        `).all(portfolioId);

        expect(transactions).toEqual([]);
        expect(holdings).toEqual([]);
    });
});