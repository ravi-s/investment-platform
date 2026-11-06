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


    it("stages valid CSV rows without modifying transactions, holdings, or import history", async () => {
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

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
                transaction_date: "2026-10-01",
                security_id: securityId,
                type: "BUY",
                quantity: 10,
                price: 2500,
            },
            {
                source_row: 3,
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
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

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

    it("rejects staging a CSV that has already been imported", async () => {
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

        // First, successfully import the CSV.
        const importedTransactions = importService.importCsv(
            userId,
            portfolioId,
            csv
        );

        expect(importedTransactions).toHaveLength(2);

        // Attempt to stage the same CSV.
        expect(() =>
            importService.stageCsv(userId, portfolioId, csv)
        ).toThrow();

        // No staging batch should have been created.
        const batches = db.prepare(`
        SELECT id
        FROM transaction_import_batches
        WHERE user_id = ? AND portfolio_id = ?
    `).all(userId, portfolioId);

        expect(batches).toHaveLength(0);

        // The original imported transactions remain intact.
        const transactions = db.prepare(`
        SELECT id
        FROM transactions
        WHERE portfolio_id = ?
    `).all(portfolioId);

        expect(transactions).toHaveLength(2);
    });


    it("rejects staging a CSV into a portfolio owned by another user", async () => {
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

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
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

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
        const csv = "transactionDate,securityId,type,quantity,price";

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
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

        // Stage the CSV first.
        const staged = importService.stageCsv(
            userId,
            portfolioId,
            csv
        );

        expect(staged.batch.status).toBe("STAGED");

        // Apply the staged batch.
        const appliedTransactions = importService.applyStagedBatch(
            userId,
            portfolioId,
            staged.batch.id
        );

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


    it("rejects applying a staged batch belonging to another user", async () => {
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

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
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

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
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

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
        const csv = [
            "transactionDate,securityId,type,quantity,price",
            `2026-10-01,${securityId},BUY,10,2500`,
            `2026-10-03,${securityId},SELL,11,2550`,
        ].join("\n");

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
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

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
        const csv = await readFile(
            new URL("./fixtures/two-valid-buy-transactions.csv", import.meta.url),
            "utf8"
        );

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

});
