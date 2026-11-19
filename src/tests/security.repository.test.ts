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

        const security = testDb
            .prepare(`
            INSERT INTO securities (name, isin)
            VALUES (?, ?)
        `)
            .run("Reliance Industries Limited", "INE002A01018");

        testDb
            .prepare(`
            INSERT INTO listings (
                security_id,
                exchange_id,
                symbol
            )
            VALUES (?, ?, ?)
        `)
            .run(
                security.lastInsertRowid,
                1,
                "RELIANCE"
            );

        testDb
            .prepare(`
            INSERT INTO listings (
                security_id,
                exchange_id,
                symbol
            )
            VALUES (?, ?, ?)
        `)
            .run(
                security.lastInsertRowid,
                2,
                "500325"
            );

        // Insert securities with NULL ISIN for testing multiple NULL values
        testDb
            .prepare(`
            INSERT INTO securities (name, isin)
            VALUES (?, ?)
        `)
            .run("Security Without ISIN 1", null);

        testDb
            .prepare(`
            INSERT INTO securities (name, isin)
            VALUES (?, ?)
        `)
            .run("Security Without ISIN 2", null);

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

    // Test 1: A security can be found using its ISIN
    it("finds a security by ISIN", () => {
        const result = repository.findByIsin("INE002A01018");

        expect(result).toBeDefined();
        expect(result?.isin).toBe("INE002A01018");
        expect(result?.name).toBe("Reliance Industries Limited");
    });

    // Test 2: ISIN lookup is case-insensitive
    it("finds a security by ISIN in a case-insensitive manner", () => {
        const result = repository.findByIsin("ine002a01018");

        expect(result).toBeDefined();
        expect(result?.isin).toBe("INE002A01018");
        expect(result?.name).toBe("Reliance Industries Limited");
    });

    // Test 3: An unknown ISIN returns undefined
    it("returns undefined for an unknown ISIN", () => {
        const result = repository.findByIsin("UNKNOWN999999");

        expect(result).toBeUndefined();
    });

    // Test 4: Two securities cannot have the same non-null ISIN
    it("prevents inserting a duplicate non-null ISIN", () => {
        const insertDuplicate = () => {
            testDb
                .prepare(`
                INSERT INTO securities (name, isin)
                VALUES (?, ?)
            `)
                .run("Another Security", "INE002A01018");
        };

        expect(insertDuplicate).toThrow();
    });

    // Test 5: Multiple securities can still have NULL ISIN
    it("allows multiple securities to have NULL ISIN", () => {
        const securities = testDb
            .prepare(`
            SELECT id, name, isin
            FROM securities
            WHERE isin IS NULL
        `)
            .all() as Array<{ id: number; name: string; isin: null }>;

        expect(securities).toHaveLength(2);
        expect(securities[0]?.isin).toBeNull();
        expect(securities[1]?.isin).toBeNull();
    });

    describe("create()", () => {
        // Test 1: Creating a security with a name and ISIN
        it("creates a security with a name and ISIN", () => {
            const created = repository.create("TCS Limited", "INE467B01029");

            expect(created).toBeDefined();
            expect(created.name).toBe("TCS Limited");
            expect(created.isin).toBe("INE467B01029");
            expect(created.id).toBeGreaterThan(0);
        });

        // Test 2: Retrieving the newly created security by ISIN
        it("can retrieve a newly created security by ISIN", () => {
            const created = repository.create("HDFC Bank Limited", "INE040A01024");
            const found = repository.findByIsin("INE040A01024");

            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
            expect(found?.name).toBe("HDFC Bank Limited");
            expect(found?.isin).toBe("INE040A01024");
        });

        // Test 3: Rejecting a duplicate ISIN through the existing unique index
        it("rejects creating a duplicate ISIN", () => {
            repository.create("Infosys Limited", "INE002A01015");

            const createDuplicate = () => {
                repository.create("Another Company", "INE002A01015");
            };

            expect(createDuplicate).toThrow();
        });

        // Test 4: Allowing multiple securities with NULL ISIN
        it("allows creating multiple securities with NULL ISIN", () => {
            const security1 = repository.create("Security Without ISIN A");
            const security2 = repository.create("Security Without ISIN B");

            expect(security1).toBeDefined();
            expect(security1.isin).toBeNull();
            expect(security2).toBeDefined();
            expect(security2.isin).toBeNull();
            expect(security1.id).not.toBe(security2.id);
        });

        // Test 5: Create with explicit NULL ISIN
        it("allows creating a security with explicit NULL ISIN", () => {
            const created = repository.create("No ISIN Company", null);

            expect(created).toBeDefined();
            expect(created.name).toBe("No ISIN Company");
            expect(created.isin).toBeNull();
        });
    });
});