import Database from "better-sqlite3";
import Fastify, { type FastifyInstance } from "fastify";
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
} from "vitest";

import { runMigrations } from "../db/migration-runner.js";
import { securityRoutes } from "../routes/security.js";
import { SecurityService } from "../services/security.js";

describe("Security routes", () => {
    let db: Database.Database;
    let app: FastifyInstance;
    let securityId: number;

    beforeAll(async () => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        runMigrations(db);

        const securityResult = db.prepare(`
            INSERT INTO securities (name)
            VALUES (?)
        `).run("Reliance Industries Limited");

        securityId = Number(securityResult.lastInsertRowid);

        db.prepare(`
            INSERT INTO listings (
                security_id,
                exchange_id,
                symbol
            )
            VALUES (?, ?, ?)
        `).run(securityId, 1, "RELIANCE");

        db.prepare(`
            INSERT INTO listings (
                security_id,
                exchange_id,
                symbol
            )
            VALUES (?, ?, ?)
        `).run(securityId, 2, "500325");

        app = Fastify();

        const service = new SecurityService(db);

        await app.register(securityRoutes, { service });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        db.close();
    });

    it("returns a security by ID", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/securities/${securityId}`,
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            id: securityId,
            name: "Reliance Industries Limited",
        });
    });

    it("returns 404 when the security does not exist", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/securities/99999",
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Security not found",
        });
    });

    it("returns 400 for a non-numeric security ID", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/securities/abc",
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({
            error: "Invalid security ID",
        });
    });

    it("returns an NSE listing by exchange and symbol", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/securities/NSE/RELIANCE",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            exchange_code: "NSE",
            symbol: "RELIANCE",
        });
    });

    it("returns a BSE listing by exchange and symbol", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/securities/BSE/500325",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            exchange_code: "BSE",
            symbol: "500325",
        });
    });

    it("returns 404 when a listing does not exist", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/securities/NSE/UNKNOWN",
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({
            error: "Security listing not found",
        });
    });
});
