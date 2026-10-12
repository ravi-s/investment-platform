import { createHash, randomBytes } from "node:crypto";

import { SessionRepository } from "../repositories/session.js";

const DEFAULT_SESSION_LIFETIME_MS =
    7 * 24 * 60 * 60 * 1000;

const INVALID_SESSION = "Invalid or expired session";

/**
 * Manages bearer-token sessions using hashed tokens for persistence.
 * The plaintext token is returned only when a session is created; callers
 * should handle it as a secret and send it only over a secure connection.
 */
export class SessionService {
    /**
     * @param repository Synchronous session persistence operations. The
     * service creates records, finds them by token hash, and deletes them by
     * token hash.
     * @param clock Current-time source, injectable to make expiry checks
     * deterministic in tests. Defaults to the system clock.
     * @param sessionLifetimeMs Session duration in milliseconds. Must be a
     * positive safe integer; defaults to seven days.
     * @throws {Error} If `sessionLifetimeMs` is not a positive safe integer.
     */
    constructor(
        private readonly repository: Pick<
            SessionRepository,
            "create" | "findByTokenHash" | "deleteByTokenHash"
        >,
        private readonly clock: () => Date = () => new Date(),
        private readonly sessionLifetimeMs: number =
            DEFAULT_SESSION_LIFETIME_MS,
    ) {
        if (
            !Number.isSafeInteger(sessionLifetimeMs) ||
            sessionLifetimeMs <= 0
        ) {
            throw new Error("Session lifetime must be a positive integer");
        }
    }

    /**
     * Creates and persists a session for `userId`.
     *
     * A cryptographically random 256-bit token is generated. Its SHA-256 hash
     * is stored in the repository, while the plaintext token is returned for
     * delivery to the client. Expiration is computed from the injected clock
     * and returned as an ISO 8601 timestamp.
     *
     * @param userId Identifier of the user who owns the session.
     * @returns The plaintext bearer token and its ISO 8601 expiration time.
     */
    createSession(userId: number) {
        const token = randomBytes(32).toString("hex");
        const tokenHash = this.hashToken(token);

        const expiresAt = new Date(
            this.clock().getTime() + this.sessionLifetimeMs,
        ).toISOString();

        this.repository.create(userId, tokenHash, expiresAt);

        return {
            token,
            expiresAt,
        };
    }

    /**
     * Finds a session using the hash of a supplied bearer token and verifies
     * that it has not expired.
     *
     * Empty or non-string values, unknown tokens, and expired sessions all
     * produce the same error. A session is expired when its expiration time
     * is equal to or earlier than the current time.
     *
     * @param token Plaintext bearer token supplied by the client.
     * @returns The matching session record from the repository.
     * @throws {Error} With `Invalid or expired session` if validation fails.
     */
    validateSession(token: string) {
        if (!token || typeof token !== "string") {
            throw new Error(INVALID_SESSION);
        }

        const tokenHash = this.hashToken(token);
        const session = this.repository.findByTokenHash(tokenHash);

        if (
            !session ||
            new Date(session.expires_at).getTime() <=
            this.clock().getTime()
        ) {
            throw new Error(INVALID_SESSION);
        }

        return session;
    }

    /**
     * Deletes the session identified by a bearer token.
     *
     * Empty or non-string values are ignored. Otherwise, the token is hashed
     * before being passed to the repository; the plaintext token is not used
     * as a persistence key.
     *
     * @param token Plaintext bearer token to revoke.
     */
    revokeSession(token: string) {
        if (!token || typeof token !== "string") {
            return;
        }

        this.repository.deleteByTokenHash(this.hashToken(token));
    }

    /** Returns the hexadecimal SHA-256 digest used to identify a token. */
    private hashToken(token: string) {
        return createHash("sha256")
            .update(token)
            .digest("hex");
    }
}
