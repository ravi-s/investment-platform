
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.ts";
import { TransactionImportBatchItemRepository } from "../repositories/transaction-import-batch-item.js";
import { TransactionImportBatchRepository } from "../repositories/transaction-batch-import.ts";

describe("TransactionImportBatchItemRepository", () => {
    let db: Database.Database;
    let itemRepository: TransactionImportBatchItemRepository;
    let batchRepository: TransactionImportBatchRepository;
    let batchId: number;
    let securityId: number;
    let userId: number;
    let portfolioId: number;

    beforeEach(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");
        runMigrations(db);

        userId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Batch Item Test User", "batch-item-test@example.com")
                .lastInsertRowid
        );

        portfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(userId, "Batch Item Test Portfolio").lastInsertRowid
        );

        securityId = Number(
            db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Batch Item Test Security").lastInsertRowid
        );

        batchRepository = new TransactionImportBatchRepository(db);
        itemRepository = new TransactionImportBatchItemRepository(db);

        batchId = batchRepository.create(
            userId,
            portfolioId,
            "b".repeat(64)
        ).id;
    });

    afterEach(() => {
        db.close();
    });

    it("creates and retrieves staged transaction rows in source order", () => {
        const items = itemRepository.createMany(batchId, [
            {
                source_row: 3,
                transaction_date: "2026-10-03",
                security_id: securityId,
                type: "BUY",
                quantity: 5,
                price: 2550,
            },
            {
                source_row: 2,
                transaction_date: "2026-10-01",
                security_id: securityId,
                type: "BUY",
                quantity: 10,
                price: 2500,
            },
        ]);

        expect(items).toHaveLength(2);
        expect(items[0]).toMatchObject({
            batch_id: batchId,
            source_row: 2,
            transaction_date: "2026-10-01",
            security_id: securityId,
            type: "BUY",
            quantity: 10,
            price: 2500,
        });
        expect(items[1]).toMatchObject({
            batch_id: batchId,
            source_row: 3,
            transaction_date: "2026-10-03",
            security_id: securityId,
            type: "BUY",
            quantity: 5,
            price: 2550,
        });

        expect(itemRepository.findByBatchId(batchId)).toEqual(items);
    });

    it("returns an empty array when a batch has no items", () => {
        expect(itemRepository.findByBatchId(batchId)).toEqual([]);
    });

    it("creates no rows when given an empty input array", () => {
        expect(itemRepository.createMany(batchId, [])).toEqual([]);
        expect(itemRepository.findByBatchId(batchId)).toEqual([]);
    });

    it("rolls back all rows if any row in createMany fails", () => {
        expect(() =>
            itemRepository.createMany(batchId, [
                {
                    source_row: 2,
                    transaction_date: "2026-10-01",
                    security_id: securityId,
                    type: "BUY",
                    quantity: 10,
                    price: 2500,
                },
                {
                    source_row: 2,
                    transaction_date: "2026-10-03",
                    security_id: securityId,
                    type: "BUY",
                    quantity: 5,
                    price: 2550,
                },
            ])
        ).toThrow();

        expect(itemRepository.findByBatchId(batchId)).toEqual([]);
    });

    it("rejects a row that references a nonexistent batch", () => {
        expect(() =>
            itemRepository.createMany(999999, [
                {
                    source_row: 2,
                    transaction_date: "2026-10-01",
                    security_id: securityId,
                    type: "BUY",
                    quantity: 10,
                    price: 2500,
                },
            ])
        ).toThrow();

        expect(
            db.prepare(`
                SELECT id FROM transaction_import_batch_items
            `).all()
        ).toEqual([]);
    });

    it("rejects a row that references a nonexistent security", () => {
        expect(() =>
            itemRepository.createMany(batchId, [
                {
                    source_row: 2,
                    transaction_date: "2026-10-01",
                    security_id: 999999,
                    type: "BUY",
                    quantity: 10,
                    price: 2500,
                },
            ])
        ).toThrow();

        expect(itemRepository.findByBatchId(batchId)).toEqual([]);
    });
});
