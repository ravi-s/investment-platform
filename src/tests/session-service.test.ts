import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { SessionService } from "../services/session.js";

describe("SessionService", () => {
    const now = new Date("2026-10-12T12:00:00.000Z");

    function createTestService() {
        const sessions = new Map<
            string,
            {
                id: number;
                user_id: number;
                token_hash: string;
                expires_at: string;
                created_at: string;
            }
        >();

        const repository = {
            create: vi.fn(
                (userId: number, tokenHash: string, expiresAt: string) => {
                    const session = {
                        id: sessions.size + 1,
                        user_id: userId,
                        token_hash: tokenHash,
                        expires_at: expiresAt,
                        created_at: now.toISOString(),
                    };

                    sessions.set(tokenHash, session);
                    return session;
                },
            ),

            findByTokenHash: vi.fn((tokenHash: string) =>
                sessions.get(tokenHash),
            ),

            deleteByTokenHash: vi.fn((tokenHash: string) => {
                sessions.delete(tokenHash);
                return { changes: 1, lastInsertRowid: 0 };
            }),
        };

        const service = new SessionService(
            repository,
            () => new Date(now),
        );

        return { service, repository, sessions };
    }

    it("creates a session and stores only the token hash", () => {
        const { service, repository } = createTestService();

        const result = service.createSession(42);

        expect(result.token).toEqual(expect.any(String));
        expect(result.token.length).toBeGreaterThan(20);

        const expectedHash = createHash("sha256")
            .update(result.token)
            .digest("hex");

        expect(repository.create).toHaveBeenCalledWith(
            42,
            expectedHash,
            expect.any(String),
        );

        expect(result.token).not.toBe(expectedHash);
    });

    it("sets the session expiry to the configured lifetime", () => {
        const { service, repository } = createTestService();

        service.createSession(42);

        const expiresAt = new Date(
            repository.create.mock.calls[0]![2],
        );

        expect(expiresAt.toISOString()).toBe(
            "2026-10-19T12:00:00.000Z",
        );
    });

    it("returns a session for a valid, unexpired token", () => {
        const { service } = createTestService();

        const created = service.createSession(42);
        const session = service.validateSession(created.token);

        expect(session).toMatchObject({
            user_id: 42,
        });
    });

    it("rejects an unknown token", () => {
        const { service } = createTestService();

        expect(() => {
            service.validateSession("unknown-session-token");
        }).toThrow("Invalid or expired session");
    });

    it("rejects an expired session", () => {
        const { service, repository } = createTestService();

        const expiredToken = "expired-session-token";
        const expiredHash = createHash("sha256")
            .update(expiredToken)
            .digest("hex");

        repository.findByTokenHash.mockReturnValueOnce({
            id: 1,
            user_id: 42,
            token_hash: expiredHash,
            expires_at: "2026-10-12T11:59:59.999Z",
            created_at: "2026-10-12T11:00:00.000Z",
        });

        expect(() => {
            service.validateSession(expiredToken);
        }).toThrow("Invalid or expired session");
    });

    it("revokes a session", () => {
        const { service, repository } = createTestService();

        const created = service.createSession(42);

        service.revokeSession(created.token);

        expect(repository.deleteByTokenHash).toHaveBeenCalledWith(
            createHash("sha256")
                .update(created.token)
                .digest("hex"),
        );
    });
});
