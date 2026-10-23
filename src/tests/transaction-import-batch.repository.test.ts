
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.js";
import { TransactionImportBatchRepository } from "../repositories/transaction-batch-import.js";

describe("TransactionImportBatchRepository", () => {
    let db: Database.Database;
    let repository: TransactionImportBatchRepository;
    let userId: number;
    let portfolioId: number;

    const contentHash = "a".repeat(64);

    beforeEach(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        userId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run(
                "Batch Test User",
                "batch-test@example.com"
            ).lastInsertRowid
        );

        portfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(userId, "Batch Test Portfolio").lastInsertRowid
        );

        repository = new TransactionImportBatchRepository(db);
    });

    afterEach(() => {
        db.close();
    });

    it("creates a staged batch and returns its persisted fields", () => {
        const batch = repository.create(
            userId,
            portfolioId,
            contentHash
        );

        expect(batch).toMatchObject({
            user_id: userId,
            portfolio_id: portfolioId,
            content_hash: contentHash,
            status: "STAGED",
            applied_at: null,
        });

        expect(batch.id).toBeGreaterThan(0);
        expect(batch.created_at).toBeTruthy();

        expect(repository.findById(batch.id)).toEqual(batch);
    });

    it("finds a batch by ID", () => {
        const created = repository.create(
            userId,
            portfolioId,
            contentHash
        );

        expect(repository.findById(created.id)).toEqual(created);
    });

    it("returns undefined when a batch does not exist", () => {
        expect(repository.findById(999999)).toBeUndefined();
    });

    it("transitions a staged batch to APPLIED and sets applied_at", () => {
        const batch = repository.create(
            userId,
            portfolioId,
            contentHash
        );

        const transitioned = repository.transitionStatus(
            batch.id,
            "APPLIED"
        );

        expect(transitioned).toBe(true);

        expect(repository.findById(batch.id)).toMatchObject({
            id: batch.id,
            status: "APPLIED",
        });

        expect(repository.findById(batch.id)?.applied_at).toBeTruthy();
    });

    it("transitions a staged batch to REJECTED without setting applied_at", () => {
        const batch = repository.create(
            userId,
            portfolioId,
            contentHash
        );

        const transitioned = repository.transitionStatus(
            batch.id,
            "REJECTED"
        );

        expect(transitioned).toBe(true);

        expect(repository.findById(batch.id)).toMatchObject({
            id: batch.id,
            status: "REJECTED",
            applied_at: null,
        });
    });

    it("does not allow a batch to transition more than once", () => {
        const batch = repository.create(
            userId,
            portfolioId,
            contentHash
        );

        expect(
            repository.transitionStatus(batch.id, "APPLIED")
        ).toBe(true);

        expect(
            repository.transitionStatus(batch.id, "REJECTED")
        ).toBe(false);

        expect(repository.findById(batch.id)).toMatchObject({
            status: "APPLIED",
        });
    });

    it("returns false when transitioning a nonexistent batch", () => {
        expect(
            repository.transitionStatus(999999, "APPLIED")
        ).toBe(false);
    });
});
