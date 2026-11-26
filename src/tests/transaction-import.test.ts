import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../db/migration-runner.ts";
import { TransactionImportService } from "../services/transaction-import-service.ts";

import { ZerodhaTransactionAdapter } from "../services/zerodha-transactional-adapter.ts";
import { SecurityRepository } from "../repositories/security.ts";

describe("Transaction CSV import", () => {
    let db: Database.Database;
    let portfolioId: number;
    let securityId: number;
    let importService: TransactionImportService;
    let userId: number;

    async function readTwoValidBuyTransactionsCsv(
        securityId: number
    ): Promise<string> {
        const template = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

        return template.replaceAll(
            "{{securityId}}",
            String(securityId)
        );
    }

    function twoValidZerodhaTransactionsCsv(): string {
        return [
            [
                "symbol", "isin", "trade_date", "exchange", "segment", "series",
                "trade_type", "auction", "quantity", "price", "trade_id",
                "order_id", "order_execution_time", "source_file",
                "source_row_number", "signed_units", "validation_flag",
            ].join(","),
            [
                "TEST", "INE000A01011", "2026-10-01", "NSE", "CASH", "EQ",
                "buy", "false", "10", "2500", "trade-001", "order-001",
                "2026-10-01 10:00:00", "zerodha-test.csv", "14", "10",
                "MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
            ].join(","),
            [
                "TEST", "INE000A01011", "2026-10-03", "NSE", "CASH", "EQ",
                "buy", "false", "5", "2550", "trade-002", "order-002",
                "2026-10-03 10:00:00", "zerodha-test.csv", "22", "5",
                "MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
            ].join(","),
        ].join("\n");
    }

    function zerodhaBuyThenSellCsv(): string {
        return [
            [
                "symbol", "isin", "trade_date", "exchange", "segment", "series",
                "trade_type", "auction", "quantity", "price", "trade_id",
                "order_id", "order_execution_time", "source_file",
                "source_row_number", "signed_units", "validation_flag",
            ].join(","),
            [
                "TEST", "INE000A01011", "2026-10-01", "NSE", "CASH", "EQ",
                "buy", "false", "10", "2500", "trade-001", "order-001",
                "2026-10-01 10:00:00", "zerodha-test.csv", "14", "10",
                "MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
            ].join(","),
            [
                "TEST", "INE000A01011", "2026-10-03", "NSE", "CASH", "EQ",
                "sell", "false", "11", "2550", "trade-002", "order-002",
                "2026-10-03 10:00:00", "zerodha-test.csv", "22", "-11",
                "MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
            ].join(","),
        ].join("\n");
    }

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
                INSERT INTO securities (name, isin)
                VALUES (?, ?)
            `).run("Import Test Security", "INE000A01011").lastInsertRowid
        );

        importService = new TransactionImportService(db);
    });

    afterEach(() => {
        db.close();
    });

    it("imports two valid BUY rows from a CSV file", async () => {
        const csv = await readTwoValidBuyTransactionsCsv(securityId);

        importService.importCsv(userId, portfolioId, csv);


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


    it("stages valid CSV rows without modifying transactions, holdings, or import history", async () => {
        const csv = twoValidZerodhaTransactionsCsv();


        const result = importService.stageCsv(userId, portfolioId, csv);

        // A reviewable batch should be created in STAGED status.
        expect(result.batch).toMatchObject({
            user_id: userId,
            portfolio_id: portfolioId,
            content_hash: createHash("sha256").update(csv).digest("hex"),
            status: "STAGED",
        });

        // Both parsed CSV rows should be persisted as batch items.
        expect(result.items).toHaveLength(2);

        expect(result.items).toMatchObject([
            {
                source_row: 2,
                source_file: "zerodha-test.csv",
                source_row_number: 14,
                isin: "INE000A01011",
                trade_id: "trade-001",
                order_id: "order-001",
                transaction_date: "2026-10-01",
                security_id: securityId,
                type: "BUY",
                quantity: 10,
                price: 2500,
            },
            {
                source_row: 3,
                source_file: "zerodha-test.csv",
                source_row_number: 22,
                isin: "INE000A01011",
                trade_id: "trade-002",
                order_id: "order-002",
                transaction_date: "2026-10-03",
                security_id: securityId,
                type: "BUY",
                quantity: 5,
                price: 2550,
            },
        ]);

        // Staging must not apply transactions.
        expect(
            db.prepare(`
            SELECT id FROM transactions WHERE portfolio_id = ?
        `).all(portfolioId)
        ).toEqual([]);

        // Staging must not create or update holdings.
        expect(
            db.prepare(`
            SELECT id, quantity FROM holdings WHERE portfolio_id = ?
        `).all(portfolioId)
        ).toEqual([]);

        // Staging must not register an applied import.
        expect(
            db.prepare(`
            SELECT id
            FROM transaction_imports
            WHERE user_id = ? AND portfolio_id = ?
        `).all(userId, portfolioId)
        ).toEqual([]);
    });


    it("rejects staging the same CSV twice", async () => {
        const csv = twoValidZerodhaTransactionsCsv();

        // First staging attempt succeeds.
        const firstResult = importService.stageCsv(
            userId,
            portfolioId,
            csv
        );

        expect(firstResult.batch.status).toBe("STAGED");
        expect(firstResult.items).toHaveLength(2);

        // Second staging attempt with identical content is rejected.
        expect(() =>
            importService.stageCsv(userId, portfolioId, csv)
        ).toThrow();

        // Only one batch should exist.
        const batches = db.prepare(`
        SELECT id
        FROM transaction_import_batches
        WHERE user_id = ? AND portfolio_id = ?
    `).all(userId, portfolioId);

        expect(batches).toHaveLength(1);

        // Only the original two staged items should exist.
        const items = db.prepare(`
        SELECT id
        FROM transaction_import_batch_items
        WHERE batch_id = ?
    `).all(firstResult.batch.id);

        expect(items).toHaveLength(2);
    });

    it("rejects staging a Zerodha CSV that has already been imported", () => {
        const csv = twoValidZerodhaTransactionsCsv();
        const contentHash = createHash("sha256").update(csv).digest("hex");

        db.prepare(`
            INSERT INTO transaction_imports (
                user_id,
                portfolio_id,
                content_hash
            )
            VALUES (?, ?, ?)
        `).run(userId, portfolioId, contentHash);

        expect(() =>
            importService.stageCsv(userId, portfolioId, csv)
        ).toThrow("CSV file has already been imported or staged");

        expect(
            db.prepare(`
                SELECT id
                FROM transaction_import_batches
                WHERE user_id = ? AND portfolio_id = ?
            `).all(userId, portfolioId)
        ).toEqual([]);

        expect(
            db.prepare(`
                SELECT user_id, portfolio_id, content_hash
                FROM transaction_imports
                WHERE user_id = ? AND portfolio_id = ?
            `).all(userId, portfolioId)
        ).toEqual([
            {
                user_id: userId,
                portfolio_id: portfolioId,
                content_hash: contentHash,
            },
        ]);
    });

    it("rejects staging a CSV into a portfolio owned by another user", async () => {
        const csv = twoValidZerodhaTransactionsCsv();

        // Create another user.
        const otherUser = db.prepare(`
        INSERT INTO users (name, email)
        VALUES (?, ?)
    `).run("other-user", "other-user@test.com");

        const otherUserId = Number(otherUser.lastInsertRowid);

        // Create a portfolio belonging to that user.
        const otherPortfolio = db.prepare(`
        INSERT INTO portfolios (user_id, name)
        VALUES (?, ?)
    `).run(otherUserId, "Other User Portfolio");

        const otherPortfolioId = Number(otherPortfolio.lastInsertRowid);

        // The current user must not stage transactions in this portfolio.
        expect(() =>
            importService.stageCsv(
                userId,
                otherPortfolioId,
                csv
            )
        ).toThrow();

        // No staging batch should have been created.
        const batches = db.prepare(`
        SELECT id
        FROM transaction_import_batches
        WHERE portfolio_id = ?
    `).all(otherPortfolioId);

        expect(batches).toHaveLength(0);

        // No staging items should have been created.
        const items = db.prepare(`
        SELECT id
        FROM transaction_import_batch_items
    `).all();

        expect(items).toHaveLength(0);
    });

    it("rolls back batch creation when staging items persistence fails", async () => {
        const csv = twoValidZerodhaTransactionsCsv();

        // Force failure when the staged items are being persisted.
        const batchItemRepository = (importService as any)
            .transactionImportBatchItemRepository;

        const createManySpy = vi
            .spyOn(batchItemRepository, "createMany")
            .mockImplementation(() => {
                throw new Error("Simulated batch-item persistence failure");
            });

        try {
            expect(() =>
                importService.stageCsv(userId, portfolioId, csv)
            ).toThrow("Simulated batch-item persistence failure");

            // The batch created earlier in the operation must be rolled back.
            const batches = db.prepare(`
            SELECT id
            FROM transaction_import_batches
            WHERE user_id = ? AND portfolio_id = ?
        `).all(userId, portfolioId);

            expect(batches).toEqual([]);

            // No batch items should remain.
            const items = db.prepare(`
            SELECT id
            FROM transaction_import_batch_items
        `).all();

            expect(items).toEqual([]);

            // Staging must not create transactions or holdings.
            expect(
                db.prepare(`
                SELECT id
                FROM transactions
                WHERE portfolio_id = ?
            `).all(portfolioId)
            ).toEqual([]);

            expect(
                db.prepare(`
                SELECT id, quantity
                FROM holdings
                WHERE portfolio_id = ?
            `).all(portfolioId)
            ).toEqual([]);

            expect(createManySpy).toHaveBeenCalledOnce();
        } finally {
            createManySpy.mockRestore();
        }
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


    it("rejects staging a header-only CSV without creating a batch", () => {
        const csv = "symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time,source_file,source_row_number,signed_units,validation_flag";

        expect(() =>
            importService.stageCsv(userId, portfolioId, csv)
        ).toThrow("CSV contains no transactions to stage");

        // No staging batch should be created.
        const batches = db.prepare(`
        SELECT id
        FROM transaction_import_batches
        WHERE user_id = ? AND portfolio_id = ?
    `).all(userId, portfolioId);

        expect(batches).toEqual([]);

        // No staging items should be created.
        const items = db.prepare(`
        SELECT id
        FROM transaction_import_batch_items
    `).all();

        expect(items).toEqual([]);

        // No transactions, holdings, or import history should be created.
        expect(
            db.prepare(`
            SELECT id
            FROM transactions
            WHERE portfolio_id = ?
        `).all(portfolioId)
        ).toEqual([]);

        expect(
            db.prepare(`
            SELECT id, quantity
            FROM holdings
            WHERE portfolio_id = ?
        `).all(portfolioId)
        ).toEqual([]);

        expect(
            db.prepare(`
            SELECT id
            FROM transaction_imports
            WHERE user_id = ? AND portfolio_id = ?
        `).all(userId, portfolioId)
        ).toEqual([]);
    });

    it("applies a staged batch and marks it as APPLIED", async () => {

        const csv = twoValidZerodhaTransactionsCsv();


        // Stage the CSV first.
        const staged = importService.stageCsv(
            userId,
            portfolioId,
            csv
        );

        expect(staged.batch.status).toBe("STAGED");

        const itemsBefore = db.prepare(`
            SELECT source_row, source_file, source_row_number, isin, trade_id, order_id,
                   security_id, type, quantity, price, transaction_date
            FROM transaction_import_batch_items
            WHERE batch_id = ?
            ORDER BY source_row
        `).all(staged.batch.id);

        expect(itemsBefore).toEqual([
            {
                source_row: 2, source_file: "zerodha-test.csv", source_row_number: 14,
                isin: "INE000A01011", trade_id: "trade-001", order_id: "order-001",
                security_id: securityId, type: "BUY", quantity: 10, price: 2500,
                transaction_date: "2026-10-01",
            },
            {
                source_row: 3, source_file: "zerodha-test.csv", source_row_number: 22,
                isin: "INE000A01011", trade_id: "trade-002", order_id: "order-002",
                security_id: securityId, type: "BUY", quantity: 5, price: 2550,
                transaction_date: "2026-10-03",
            },
        ]);

        // Apply the staged batch.
        const appliedTransactions = importService.applyStagedBatch(
            userId,
            portfolioId,
            staged.batch.id
        ) as Array<{ id: number }>;

        expect(appliedTransactions).toHaveLength(2);

        // Verify the transactions were created.
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

        // Each staged row must retain its provenance and link to its transaction.
        const itemsAfter = db.prepare(`
            SELECT *
            FROM transaction_import_batch_items
            WHERE batch_id = ?
            ORDER BY source_row
        `).all(staged.batch.id) as Array<{
            source_row: number;
            source_file: string;
            source_row_number: number;
            isin: string;
            trade_id: string;
            order_id: string;
            security_id: number;
            type: string;
            quantity: number;
            price: number;
            transaction_date: string;
            transaction_id: number | null;
        }>;

        expect(itemsAfter.map(({ source_row, source_file, source_row_number, isin,
            trade_id, order_id, security_id, type, quantity, price, transaction_date }) => ({
                source_row, source_file, source_row_number, isin, trade_id, order_id,
                security_id, type, quantity, price, transaction_date,
            }))).toEqual(itemsBefore);

        expect(itemsAfter).toHaveLength(appliedTransactions.length);

        expect(
            itemsAfter.map(item => item.transaction_id)
        ).toEqual(
            appliedTransactions.map(transaction => transaction.id)
        );

        expect(
            new Set(itemsAfter.map(item => item.transaction_id)).size
        ).toBe(itemsAfter.length);

        // Holdings should reflect both transactions.
        const holding = db.prepare(`
        SELECT quantity
        FROM holdings
        WHERE portfolio_id = ? AND security_id = ?
    `).get(portfolioId, securityId);

        expect(holding).toEqual({ quantity: 15 });

        // Import history should be registered using the original CSV hash.
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

        // The batch must now be APPLIED.
        const batch = db.prepare(`
        SELECT status, applied_at
        FROM transaction_import_batches
        WHERE id = ?
    `).get(staged.batch.id) as { status: string; applied_at: string | null };

        expect(batch?.status).toBe("APPLIED");
        expect(batch?.applied_at).not.toBeNull();
    });


    it("rolls back transactions, holdings, and provenance links when association fails", () => {
        const csv = twoValidZerodhaTransactionsCsv();
        const staged = importService.stageCsv(userId, portfolioId, csv);

        const itemRepository = (importService as any)
            .transactionImportBatchItemRepository;

        const associateWithTransaction =
            itemRepository.associateWithTransaction.bind(itemRepository);

        let associationCount = 0;

        const associateSpy = vi
            .spyOn(itemRepository, "associateWithTransaction")
            .mockImplementation((itemId, transactionId) => {
                associationCount += 1;

                if (associationCount === 2) {
                    throw new Error(
                        "Simulated transaction association failure"
                    );
                }

                // Execute the real repository operation for the first item.
                return associateWithTransaction(itemId, transactionId);
            });

        try {
            expect(() =>
                importService.applyStagedBatch(
                    userId,
                    portfolioId,
                    staged.batch.id
                )
            ).toThrow("Simulated transaction association failure");

            expect(associateSpy).toHaveBeenCalledTimes(2);

            // Transaction inserts must be rolled back.
            expect(
                db.prepare(`
                SELECT id
                FROM transactions
                WHERE portfolio_id = ?
            `).all(portfolioId)
            ).toEqual([]);

            // Holding changes must be rolled back.
            expect(
                db.prepare(`
                SELECT id, quantity
                FROM holdings
                WHERE portfolio_id = ?
            `).all(portfolioId)
            ).toEqual([]);

            // Even the first successfully written association must be rolled back.
            expect(
                db.prepare(`
                SELECT transaction_id
                FROM transaction_import_batch_items
                WHERE batch_id = ?
                ORDER BY source_row
            `).all(staged.batch.id)
            ).toEqual([
                { transaction_id: null },
                { transaction_id: null },
            ]);

            // Import history must remain empty.
            expect(
                db.prepare(`
                SELECT id
                FROM transaction_imports
                WHERE user_id = ? AND portfolio_id = ?
            `).all(userId, portfolioId)
            ).toEqual([]);

            // The batch must remain available for retry.
            const batch = db.prepare(`
            SELECT status, applied_at
            FROM transaction_import_batches
            WHERE id = ?
        `).get(staged.batch.id) as {
                status: string;
                applied_at: string | null;
            };

            expect(batch?.status).toBe("STAGED");
            expect(batch?.applied_at).toBeNull();

        } finally {
            associateSpy.mockRestore();
        }
    });


    it("rejects applying a staged batch belonging to another user", async () => {
        const csv = twoValidZerodhaTransactionsCsv();

        // Create another user.
        const otherUserId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Other User", "other-user-apply@example.com").lastInsertRowid
        );

        // Create a portfolio belonging to that user.
        const otherPortfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(otherUserId, "Other User Portfolio").lastInsertRowid
        );

        // Stage a batch under the other user's ownership.
        const staged = importService.stageCsv(
            otherUserId,
            otherPortfolioId,
            csv
        );

        expect(staged.batch.status).toBe("STAGED");

        // The current user attempts to apply the other user's batch.
        expect(() =>
            importService.applyStagedBatch(
                userId,
                portfolioId,
                staged.batch.id
            )
        ).toThrow("Import batch not found");

        // No transactions should have been created.
        expect(
            db.prepare(`
                SELECT id
                FROM transactions
                WHERE portfolio_id = ?
            `).all(otherPortfolioId)
        ).toEqual([]);

        // No holdings should have been created.
        expect(
            db.prepare(`
                SELECT id, quantity
                FROM holdings
                WHERE portfolio_id = ?
            `).all(otherPortfolioId)
        ).toEqual([]);

        // The batch must remain STAGED.
        const batch = db.prepare(`
            SELECT status, applied_at
            FROM transaction_import_batches
            WHERE id = ?
        `).get(staged.batch.id) as { status: string; applied_at: string | null };

        expect(batch?.status).toBe("STAGED");
        expect(batch?.applied_at).toBeNull();
    });

    it("rejects reapplying an already applied batch without duplicating transactions", async () => {
        const csv = twoValidZerodhaTransactionsCsv();

        // Stage and apply the batch once.
        const staged = importService.stageCsv(userId, portfolioId, csv);

        const firstApplication = importService.applyStagedBatch(
            userId,
            portfolioId,
            staged.batch.id
        );

        expect(firstApplication).toHaveLength(2);

        // Capture the database state after the successful application.
        const transactionsBefore = db.prepare(`
        SELECT id, security_id, type, quantity, price, transaction_date
        FROM transactions
        WHERE portfolio_id = ?
        ORDER BY id
    `).all(portfolioId);

        const holdingBefore = db.prepare(`
        SELECT quantity
        FROM holdings
        WHERE portfolio_id = ? AND security_id = ?
    `).get(portfolioId, securityId);

        const importHistoryBefore = db.prepare(`
        SELECT id, user_id, portfolio_id, content_hash
        FROM transaction_imports
        WHERE user_id = ? AND portfolio_id = ?
    `).all(userId, portfolioId);

        // Attempt to apply the same batch again.
        expect(() =>
            importService.applyStagedBatch(
                userId,
                portfolioId,
                staged.batch.id
            )
        ).toThrow("Import batch is not in STAGED status");

        // No duplicate transactions.
        const transactionsAfter = db.prepare(`
        SELECT id, security_id, type, quantity, price, transaction_date
        FROM transactions
        WHERE portfolio_id = ?
        ORDER BY id
    `).all(portfolioId);

        expect(transactionsAfter).toEqual(transactionsBefore);

        // Holdings remain unchanged.
        const holdingAfter = db.prepare(`
        SELECT quantity
        FROM holdings
        WHERE portfolio_id = ? AND security_id = ?
    `).get(portfolioId, securityId);

        expect(holdingAfter).toEqual(holdingBefore);

        // Import history remains unchanged.
        const importHistoryAfter = db.prepare(`
        SELECT id, user_id, portfolio_id, content_hash
        FROM transaction_imports
        WHERE user_id = ? AND portfolio_id = ?
    `).all(userId, portfolioId);

        expect(importHistoryAfter).toEqual(importHistoryBefore);

        // The batch remains APPLIED.
        const batch = db.prepare(`
        SELECT status, applied_at
        FROM transaction_import_batches
        WHERE id = ?
    `).get(staged.batch.id) as { status: string; applied_at: string | null };

        expect(batch?.status).toBe("APPLIED");
        expect(batch?.applied_at).not.toBeNull();
    });


    it("rolls back transaction and holding writes when applying a staged batch fails", async () => {
        const csv = twoValidZerodhaTransactionsCsv();

        // Stage the CSV first.
        const staged = importService.stageCsv(userId, portfolioId, csv);

        expect(staged.batch.status).toBe("STAGED");

        // Force failure at import-history registration, after transactions
        // and holdings have been written within the enclosing transaction.
        const historyRepository = (importService as any).importHistoryRepository;

        const createSpy = vi
            .spyOn(historyRepository, "create")
            .mockImplementation(() => {
                throw new Error("Simulated import-history persistence failure");
            });

        try {
            expect(() =>
                importService.applyStagedBatch(
                    userId,
                    portfolioId,
                    staged.batch.id
                )
            ).toThrow("Simulated import-history persistence failure");

            // All transaction writes must have been rolled back.
            expect(
                db.prepare(`
                SELECT id
                FROM transactions
                WHERE portfolio_id = ?
            `).all(portfolioId)
            ).toEqual([]);

            // All holding writes must have been rolled back.
            expect(
                db.prepare(`
                SELECT id, quantity
                FROM holdings
                WHERE portfolio_id = ?
            `).all(portfolioId)
            ).toEqual([]);

            // Import history must remain empty.
            expect(
                db.prepare(`
                SELECT id
                FROM transaction_imports
                WHERE user_id = ? AND portfolio_id = ?
            `).all(userId, portfolioId)
            ).toEqual([]);

            // The batch must remain STAGED, not partially applied.
            const batch = db.prepare(`
            SELECT status, applied_at
            FROM transaction_import_batches
            WHERE id = ?
        `).get(staged.batch.id) as { status: string; applied_at: string | null };

            expect(batch?.status).toBe("STAGED");
            expect(batch?.applied_at).toBeNull();

            // Staged items must still be available for retry.
            const items = db.prepare(`
            SELECT id
            FROM transaction_import_batch_items
            WHERE batch_id = ?
        `).all(staged.batch.id);

            expect(items).toHaveLength(2);
            expect(createSpy).toHaveBeenCalledOnce();
        } finally {
            createSpy.mockRestore();
        }
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

    it("rolls back all changes when applying a staged batch encounters insufficient holdings", () => {
        const csv = zerodhaBuyThenSellCsv();

        const staged = importService.stageCsv(userId, portfolioId, csv);

        expect(() =>
            importService.applyStagedBatch(
                userId,
                portfolioId,
                staged.batch.id
            )
        ).toThrow("Insufficient holding");

        expect(
            db.prepare(`
                SELECT id
                FROM transactions
                WHERE portfolio_id = ?
            `).all(portfolioId)
        ).toEqual([]);

        expect(
            db.prepare(`
                SELECT id, quantity
                FROM holdings
                WHERE portfolio_id = ?
            `).all(portfolioId)
        ).toEqual([]);

        expect(
            db.prepare(`
                SELECT id
                FROM transaction_imports
                WHERE user_id = ? AND portfolio_id = ?
            `).all(userId, portfolioId)
        ).toEqual([]);

        const batch = db.prepare(`
            SELECT status, applied_at
            FROM transaction_import_batches
            WHERE id = ?
        `).get(staged.batch.id) as { status: string; applied_at: string | null };

        expect(batch?.status).toBe("STAGED");
        expect(batch?.applied_at).toBeNull();

        expect(importService.findBatchItems(staged.batch.id)).toMatchObject([
            { source_row: 2, type: "BUY", quantity: 10 },
            { source_row: 3, type: "SELL", quantity: 11 },
        ]);
    });

    it("rolls back all changes when a staged batch cannot transition to APPLIED", async () => {
        const csv = twoValidZerodhaTransactionsCsv();

        const staged = importService.stageCsv(userId, portfolioId, csv);
        const batchRepository = (importService as any)
            .transactionImportBatchRepository;
        const transitionSpy = vi
            .spyOn(batchRepository, "transitionStatus")
            .mockReturnValue(false);

        try {
            expect(() =>
                importService.applyStagedBatch(
                    userId,
                    portfolioId,
                    staged.batch.id
                )
            ).toThrow("Failed to transition import batch to APPLIED");

            expect(
                db.prepare(`
                    SELECT id
                    FROM transactions
                    WHERE portfolio_id = ?
                `).all(portfolioId)
            ).toEqual([]);

            expect(
                db.prepare(`
                    SELECT id, quantity
                    FROM holdings
                    WHERE portfolio_id = ?
                `).all(portfolioId)
            ).toEqual([]);

            expect(
                db.prepare(`
                    SELECT id
                    FROM transaction_imports
                    WHERE user_id = ? AND portfolio_id = ?
                `).all(userId, portfolioId)
            ).toEqual([]);

            const batch = db.prepare(`
                SELECT status, applied_at
                FROM transaction_import_batches
                WHERE id = ?
            `).get(staged.batch.id) as { status: string; applied_at: string | null };

            expect(batch?.status).toBe("STAGED");
            expect(batch?.applied_at).toBeNull();

            const items = db.prepare(`
                SELECT id
                FROM transaction_import_batch_items
                WHERE batch_id = ?
            `).all(staged.batch.id);

            expect(items).toHaveLength(2);
            expect(transitionSpy).toHaveBeenCalledOnce();
            expect(transitionSpy).toHaveBeenCalledWith(
                staged.batch.id,
                "APPLIED"
            );
        } finally {
            transitionSpy.mockRestore();
        }
    });

    it("successfully applies a staged batch after a failed application", async () => {
        const csv = twoValidZerodhaTransactionsCsv();


        const staged = importService.stageCsv(userId, portfolioId, csv);
        const batchRepository = (importService as any)
            .transactionImportBatchRepository;
        const transitionSpy = vi
            .spyOn(batchRepository, "transitionStatus")
            .mockReturnValue(false);

        try {
            expect(() =>
                importService.applyStagedBatch(
                    userId,
                    portfolioId,
                    staged.batch.id
                )
            ).toThrow("Failed to transition import batch to APPLIED");

            expect(
                db.prepare(`
                    SELECT id
                    FROM transactions
                    WHERE portfolio_id = ?
                `).all(portfolioId)
            ).toEqual([]);

            expect(
                db.prepare(`
                    SELECT id, quantity
                    FROM holdings
                    WHERE portfolio_id = ?
                `).all(portfolioId)
            ).toEqual([]);

            expect(
                db.prepare(`
                    SELECT id
                    FROM transaction_imports
                    WHERE user_id = ? AND portfolio_id = ?
                `).all(userId, portfolioId)
            ).toEqual([]);

            let batch = db.prepare(`
                SELECT status, applied_at
                FROM transaction_import_batches
                WHERE id = ?
            `).get(staged.batch.id) as { status: string; applied_at: string | null };

            expect(batch?.status).toBe("STAGED");
            expect(batch?.applied_at).toBeNull();

            expect(importService.findBatchItems(staged.batch.id)).toHaveLength(2);
            expect(transitionSpy).toHaveBeenCalledOnce();
            expect(transitionSpy).toHaveBeenCalledWith(
                staged.batch.id,
                "APPLIED"
            );

            transitionSpy.mockRestore();

            const appliedTransactions = importService.applyStagedBatch(
                userId,
                portfolioId,
                staged.batch.id
            );

            expect(appliedTransactions).toHaveLength(2);
            expect(
                db.prepare(`
                    SELECT type, quantity
                    FROM transactions
                    WHERE portfolio_id = ?
                    ORDER BY transaction_date
                `).all(portfolioId)
            ).toEqual([
                { type: "BUY", quantity: 10 },
                { type: "BUY", quantity: 5 },
            ]);

            expect(
                db.prepare(`
                    SELECT quantity
                    FROM holdings
                    WHERE portfolio_id = ? AND security_id = ?
                `).get(portfolioId, securityId)
            ).toEqual({ quantity: 15 });

            expect(
                db.prepare(`
                    SELECT user_id, portfolio_id, content_hash
                    FROM transaction_imports
                    WHERE user_id = ? AND portfolio_id = ?
                `).all(userId, portfolioId)
            ).toEqual([
                {
                    user_id: userId,
                    portfolio_id: portfolioId,
                    content_hash: createHash("sha256").update(csv).digest("hex"),
                },
            ]);

            batch = db.prepare(`
                SELECT status, applied_at
                FROM transaction_import_batches
                WHERE id = ?
            `).get(staged.batch.id) as { status: string; applied_at: string | null };

            expect(batch?.status).toBe("APPLIED");
            expect(batch?.applied_at).not.toBeNull();
        } finally {
            transitionSpy.mockRestore();
        }
    });

    it("stages all 477 Zerodha transactions with complete provenance", async () => {
        const csv = await readFile(
            new URL(
                "./fixtures/consolidated_current_holdings_transactions_2018_2026.csv",
                import.meta.url
            ),
            "utf8"
        );

        // Use the real adapter to establish the expected adapted records.
        const adapter = new ZerodhaTransactionAdapter(
            new SecurityRepository(db)
        );
        const adaptedTransactions = adapter.adapt(csv);

        expect(adaptedTransactions).toHaveLength(477);

        // Stage through the shared CSV staging workflow.
        const result = importService.stageCsv(
            userId,
            portfolioId,
            csv
        );

        expect(result.batch).toMatchObject({
            user_id: userId,
            portfolio_id: portfolioId,
            content_hash: createHash("sha256").update(csv).digest("hex"),
            status: "STAGED",
        });

        expect(result.items).toHaveLength(477);

        // Verify transaction type counts.
        expect(result.items.filter(item => item.type === "BUY")).toHaveLength(396);
        expect(result.items.filter(item => item.type === "SELL")).toHaveLength(81);

        // Verify all five provenance fields and source-row positioning.
        expect(
            result.items.map(item => ({
                source_row: item.source_row,
                source_file: item.source_file,
                source_row_number: item.source_row_number,
                isin: item.isin,
                trade_id: item.trade_id,
                order_id: item.order_id,
            }))
        ).toEqual(
            adaptedTransactions.map(transaction => ({
                source_row: transaction.sourceRow,
                source_file: transaction.sourceFile,
                source_row_number: transaction.sourceRowNumber,
                isin: transaction.isin,
                trade_id: transaction.tradeId,
                order_id: transaction.orderId,
            }))
        );

        // Both distinct ICICI purchases on 2026-05-05 must survive staging.
        const iciciPurchases = result.items.filter(item =>
            item.transaction_date === "2026-05-05" &&
            item.isin === "INF109K01W82" &&
            item.type === "BUY" &&
            item.quantity === 71.157 &&
            item.price === 70.2634
        );

        expect(iciciPurchases).toHaveLength(2);
        expect(new Set(iciciPurchases.map(item => item.source_row)).size).toBe(2);

        // Verify exactly one staged batch and 477 persisted items.
        expect(
            db.prepare(`
            SELECT COUNT(*) AS count
            FROM transaction_import_batches
            WHERE user_id = ? AND portfolio_id = ?
        `).get(userId, portfolioId)
        ).toEqual({ count: 1 });

        expect(
            db.prepare(`
            SELECT COUNT(*) AS count
            FROM transaction_import_batch_items
            WHERE batch_id = ?
        `).get(result.batch.id)
        ).toEqual({ count: 477 });

        // Staging must not create financial transactions.
        expect(
            db.prepare(`
            SELECT id FROM transactions WHERE portfolio_id = ?
        `).all(portfolioId)
        ).toEqual([]);

        // Staging must not create holdings.
        expect(
            db.prepare(`
            SELECT id FROM holdings WHERE portfolio_id = ?
        `).all(portfolioId)
        ).toEqual([]);

        // Staging must not register an applied import.
        expect(
            db.prepare(`
            SELECT id
            FROM transaction_imports
            WHERE user_id = ? AND portfolio_id = ?
        `).all(userId, portfolioId)
        ).toEqual([]);

        const provenanceCounts = db.prepare(`
            SELECT
                COUNT(*) AS total_items,
                SUM(type = 'BUY') AS buy_count,
                SUM(type = 'SELL') AS sell_count,
                SUM(source_file IS NOT NULL) AS with_source_file,
                SUM(source_row_number IS NOT NULL) AS with_source_row,
                SUM(isin IS NOT NULL) AS with_isin,
                SUM(trade_id IS NOT NULL) AS with_trade_id,
                SUM(order_id IS NOT NULL) AS with_order_id
            FROM transaction_import_batch_items
            WHERE batch_id = ?
        `).get(result.batch.id);

        expect(provenanceCounts).toMatchObject({
            total_items: 477,
            buy_count: 396,
            sell_count: 81,
            with_source_file: 477,
            with_source_row: 477,
            with_isin: 477,
        });
    });
});
