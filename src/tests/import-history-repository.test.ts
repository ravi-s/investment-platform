
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.js";
import { ImportHistoryRepository } from "../repositories/import-history.js";

describe("ImportHistoryRepository", () => {
    let db: Database.Database;
    let repository: ImportHistoryRepository;
    let userId: number;
    let portfolioId: number;
    let anotherPortfolioId: number;
    let anotherUserId: number;

    const contentHash = "a".repeat(64);

    beforeEach(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        userId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Import User", "import@example.com").lastInsertRowid
        );

        anotherUserId = Number(
            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Another User", "another@example.com").lastInsertRowid
        );

        portfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(userId, "Portfolio A").lastInsertRowid
        );

        anotherPortfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(userId, "Portfolio B").lastInsertRowid
        );

        repository = new ImportHistoryRepository(db);
    });

    afterEach(() => {
        db.close();
    });

    it("registers an import and returns its persisted record", () => {
        const result = repository.create(userId, portfolioId, contentHash);

        expect(result).toMatchObject({
            id: expect.any(Number),
            user_id: userId,
            portfolio_id: portfolioId,
            content_hash: contentHash,
            imported_at: expect.any(String),
        });
    });

    it("finds an import by user, portfolio, and content hash", () => {
        repository.create(userId, portfolioId, contentHash);

        expect(
            repository.exists(userId, portfolioId, contentHash)
        ).toBe(true);
    });

    it("returns false when the content hash has not been imported", () => {
        expect(
            repository.exists(userId, portfolioId, "b".repeat(64))
        ).toBe(false);
    });

    it("allows the same content hash in a different portfolio", () => {
        repository.create(userId, portfolioId, contentHash);

        const result = repository.create(
            userId,
            anotherPortfolioId,
            contentHash
        );

        expect(result?.portfolio_id).toBe(anotherPortfolioId);
        expect(
            repository.exists(userId, anotherPortfolioId, contentHash)
        ).toBe(true);
    });

    it("allows the same content hash for a different user", () => {
        const anotherUsersPortfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(anotherUserId, "Another User Portfolio").lastInsertRowid
        );

        repository.create(userId, portfolioId, contentHash);

        const result = repository.create(
            anotherUserId,
            anotherUsersPortfolioId,
            contentHash
        );

        expect(result?.user_id).toBe(anotherUserId);
        expect(
            repository.exists(
                anotherUserId,
                anotherUsersPortfolioId,
                contentHash
            )
        ).toBe(true);
    });

    it("rejects registering the same import twice", () => {
        repository.create(userId, portfolioId, contentHash);

        expect(() =>
            repository.create(userId, portfolioId, contentHash)
        ).toThrow();
    });
});
