import Database from "better-sqlite3";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runMigrations } from "../db/migration-runner.js";
import { InvestmentEventRepository } from "../repositories/investment-event.js";

describe("InvestmentEventRepository", () => {
    let testDb: Database.Database;
    let repository: InvestmentEventRepository;


    beforeAll(() => {
        testDb = new Database(":memory:");
        testDb.pragma("foreign_keys = ON");

        runMigrations(testDb);

        const security = testDb
            .prepare(`
            INSERT INTO securities(name)
    VALUES(?)
        `)
            .run("Reliance Industries Limited");

        repository = new InvestmentEventRepository(testDb);

        repository.create(
            Number(security.lastInsertRowid),
            "DIVIDEND",
            "2026-09-10",
            "2026-09-11",
            "2026-09-25",
            10,
            "INR"
        );
    });

    afterAll(() => {
        testDb.close();
    });

    it("finds a dividend investment event by id", () => {
        const result = repository.findById(1);

        expect(result).toBeDefined();
        expect(result?.id).toBe(1);
        expect(result?.security_id).toBe(1);
        expect(result?.event_type).toBe("DIVIDEND");
        expect(result?.ex_date).toBe("2026-09-10");
        expect(result?.record_date).toBe("2026-09-11");
        expect(result?.payment_date).toBe("2026-09-25");
        expect(result?.amount_per_unit).toBe(10);
        expect(result?.currency).toBe("INR");
    });

    it("rejects a non-positive dividend amount", () => {
        expect(() =>
            repository.create(
                1,
                "DIVIDEND",
                "2026-10-01",
                "2026-10-02",
                "2026-10-03",
                0,
                "INR"
            )
        ).toThrow();
    });

    it("rejects a record date before the ex-date", () => {
        expect(() =>
            repository.create(
                1,
                "DIVIDEND",
                "2026-10-10",
                "2026-10-09",
                "2026-10-11",
                10,
                "INR"
            )
        ).toThrow();
    });

    it("rejects a payment date before the ex-date", () => {
        expect(() =>
            repository.create(
                1,
                "DIVIDEND",
                "2026-10-10",
                "2026-10-11",
                "2026-10-09",
                10,
                "INR"
            )
        ).toThrow();
    });



});
