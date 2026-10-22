import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../db/migration-runner.js";
import { TransactionImportService } from "../services/transaction-import-service.js";

describe("Transaction CSV import", () => {
    let db: Database.Database;
    let portfolioId: number;
    let securityId: number;
    let importService: TransactionImportService;
    let userId: number;

    beforeEach(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);


        userId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Import Test User", "transaction-import@example.com").lastInsertRowid
        );

        portfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(userId, "Import Test Portfolio").lastInsertRowid
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

        await importService.importCsv(userId, portfolioId, csv);

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

        const importHistory = db.prepare(`
            SELECT user_id, portfolio_id, content_hash
            FROM transaction_imports
            WHERE user_id = ? AND portfolio_id = ?
            `).all(userId, portfolioId);

        expect(importHistory).toHaveLength(1);
        expect(importHistory[0]).toMatchObject({
            user_id: userId,
            portfolio_id: portfolioId,
            content_hash: createHash("sha256").update(csv).digest("hex"),
        });
    });

    it("leaves the database unchanged when a valid row is followed by an invalid row", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
            `2026-10-03,${securityId},SELL,11,2550`,
        ].join("\n");

        expect(() => importService.importCsv(userId, portfolioId, csv)).toThrow(
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

        const importHistory = db.prepare(`
            SELECT id
            FROM transaction_imports
            WHERE user_id = ? AND portfolio_id = ?
        `).all(userId, portfolioId);

        expect(importHistory).toEqual([]);
    });

    it("leaves the database unchanged when the second CSV row is missing a required value", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
            `2026-10-03,${securityId},BUY,,2550`,
        ].join("\n");

        expect(() => importService.importCsv(userId, portfolioId, csv)).toThrow(
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

        const importHistory = db.prepare(`
            SELECT id
            FROM transaction_imports
            WHERE user_id = ? AND portfolio_id = ?
        `).all(userId, portfolioId);

        expect(importHistory).toEqual([]);
    });

    it("imports correctly when CSV columns are reordered", () => {
        const csv = [
            "price,type,transactionDate,quantity,securityId",
            `2500,BUY,2026-10-01,10,${securityId}`,
        ].join("\n");

        importService.importCsv(userId, portfolioId, csv);

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

        expect(importService.importCsv(userId, portfolioId, csv)).toEqual([]);

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

        const importHistory = db.prepare(`
            SELECT id
            FROM transaction_imports
            WHERE user_id = ? AND portfolio_id = ?
        `).all(userId, portfolioId);

        expect(importHistory).toEqual([]);
    });

    it("rejects a whitespace-only record instead of silently ignoring it", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            "   ",
        ].join("\n");

        expect(() => importService.importCsv(userId, portfolioId, csv)).toThrow(
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

        const importHistory = db.prepare(`
            SELECT id
            FROM transaction_imports
            WHERE user_id = ? AND portfolio_id = ?
        `).all(userId, portfolioId);

        expect(importHistory).toEqual([]);
    });

    it("rejects a delimiter-only record because required values are missing", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            ",,,,",
        ].join("\n");

        expect(() => importService.importCsv(userId, portfolioId, csv)).toThrow(
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

        const importHistory = db.prepare(`
            SELECT id
            FROM transaction_imports
            WHERE user_id = ? AND portfolio_id = ?
        `).all(userId, portfolioId);

        expect(importHistory).toEqual([]);
    });

    it("rejects importing into a portfolio owned by another user", () => {
        const anotherUserId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Another User", "another-transaction-import@example.com").lastInsertRowid
        );
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
        ].join("\n");

        expect(() => importService.importCsv(anotherUserId, portfolioId, csv)).toThrow(
            "Portfolio not found"
        );

        expect(db.prepare(`
            SELECT id
            FROM transactions
            WHERE portfolio_id = ?
        `).all(portfolioId)).toEqual([]);
        expect(db.prepare(`
            SELECT id
            FROM transaction_imports
            WHERE portfolio_id = ?
        `).all(portfolioId)).toEqual([]);
    });

    it("rejects duplicate CSV headers", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price,price",
            `2026-10-01,${securityId},BUY,10,2500,2500`,
        ].join("\n");

        expect(() => importService.importCsv(userId, portfolioId, csv)).toThrow(
            "Invalid CSV: duplicate header price"
        );

        const transactions = db.prepare(`
        SELECT id FROM transactions WHERE portfolio_id = ?
       `).all(portfolioId);

        expect(transactions).toEqual([]);
    });

    it("rejects CSV files with a missing required header", () => {
        const csv = [
            "transactionDate,securityId,type,quantity",
            `2026-10-01,${securityId},BUY,10`,
        ].join("\n");

        expect(() => importService.importCsv(userId, portfolioId, csv)).toThrow(
            "Invalid CSV: missing required header price"
        );

        const transactions = db.prepare(`
        SELECT id FROM transactions WHERE portfolio_id = ?
       `).all(portfolioId);

        expect(transactions).toEqual([]);
    });

    it("rejects invalid calendar dates in CSV rows", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-02-30,${securityId},BUY,10,2500`,
        ].join("\n");

        expect(() => importService.importCsv(userId, portfolioId, csv)).toThrow(
            "Invalid CSV row 2: transactionDate must be a valid YYYY-MM-DD date"
        );

        const transactions = db.prepare(`
         SELECT id FROM transactions WHERE portfolio_id = ?
       `).all(portfolioId);

        expect(transactions).toEqual([]);
    });

    it("rejects importing the same CSV twice without changing transactions or holdings", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
        ].join("\n");

        expect(importService.importCsv(userId, portfolioId, csv)).toHaveLength(1);

        const transactionCountBeforeDuplicate = db.prepare(`
            SELECT COUNT(*) AS count
            FROM transactions
            WHERE portfolio_id = ?
        `).get(portfolioId);
        const holdingBeforeDuplicate = db.prepare(`
            SELECT quantity
            FROM holdings
            WHERE portfolio_id = ? AND security_id = ?
        `).get(portfolioId, securityId);

        expect(() => importService.importCsv(userId, portfolioId, csv)).toThrow(
            "CSV file has already been imported"
        );

        const transactionCountAfterDuplicate = db.prepare(`
            SELECT COUNT(*) AS count
            FROM transactions
            WHERE portfolio_id = ?
        `).get(portfolioId);
        const holdingAfterDuplicate = db.prepare(`
            SELECT quantity
            FROM holdings
            WHERE portfolio_id = ? AND security_id = ?
        `).get(portfolioId, securityId);

        expect(transactionCountAfterDuplicate).toEqual(transactionCountBeforeDuplicate);
        expect(holdingAfterDuplicate).toEqual(holdingBeforeDuplicate);

        const importHistory = db.prepare(`
            SELECT id
            FROM transaction_imports
            WHERE user_id = ? AND portfolio_id = ?
            `).all(userId, portfolioId);

        expect(importHistory).toHaveLength(1);
    });

    it("rolls back transaction and holding writes when import-history registration fails", () => {
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
        ].join("\n");

        // Force failure at the final persistence step, after the BUY
        // transaction and its holding update have been attempted.
        const historyRepository = (importService as any).importHistoryRepository;
        const createSpy = vi
            .spyOn(historyRepository, "create")
            .mockImplementation(() => {
                throw new Error("Simulated import-history persistence failure");
            });

        try {
            expect(() => importService.importCsv(userId, portfolioId, csv)).toThrow(
                "Simulated import-history persistence failure"
            );

            // The transaction insert must have rolled back.
            expect(
                db.prepare(`
                SELECT id
                FROM transactions
                WHERE portfolio_id = ?
            `).all(portfolioId)
            ).toEqual([]);

            // The holding insert/update must have rolled back too.
            expect(
                db.prepare(`
                SELECT id, quantity
                FROM holdings
                WHERE portfolio_id = ?
            `).all(portfolioId)
            ).toEqual([]);

            // No import-history record should remain.
            expect(
                db.prepare(`
                SELECT id
                FROM transaction_imports
                WHERE user_id = ? AND portfolio_id = ?
            `).all(userId, portfolioId)
            ).toEqual([]);

            expect(createSpy).toHaveBeenCalledOnce();
        } finally {
            createSpy.mockRestore();
        }
    });

});
