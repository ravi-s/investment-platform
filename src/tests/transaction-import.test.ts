import { readFile } from "node:fs/promises";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.js";
import { TransactionImportService } from "../services/transaction-import-service.js";

describe("Transaction CSV import", () => {
    let db: Database.Database;
    let portfolioId: number;
    let securityId: number;
    let importService: TransactionImportService;

    beforeAll(() => {
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

    afterAll(() => {
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
});