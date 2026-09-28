import Database from "better-sqlite3";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runMigrations } from "../db/migration-runner.js";
import { SecurityRepository } from "../repositories/security.js";

describe("SecurityRepository", () => {
    let testDb: Database.Database;
    let repository: SecurityRepository;

    beforeAll(() => {
        testDb = new Database(":memory:");
        testDb.pragma("foreign_keys = ON");

        runMigrations(testDb);

        repository = new SecurityRepository(testDb);
    });

    afterAll(() => {
        testDb.close();
    });

    it("finds a security by id", () => {
        const result = repository.findById(1);

        expect(result).toBeDefined();
        expect(result?.id).toBe(1);
    });

    it("finds a listing by exchange and symbol", () => {
        const result = repository.findListing("NSE", "RELIANCE");

        expect(result).toBeDefined();
        expect(result?.exchange_code).toBe("NSE");
        expect(result?.symbol).toBe("RELIANCE");
    });

    it("finds a BSE listing by exchange and symbol", () => {
        const result = repository.findListing("BSE", "500325");

        expect(result).toBeDefined();
        expect(result?.exchange_code).toBe("BSE");
        expect(result?.symbol).toBe("500325");
    });
});