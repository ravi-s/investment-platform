import type Database from "better-sqlite3";

/** Provides database operations for user sessions. */
export class SessionRepository {
    constructor(private readonly db: Database.Database) { }

    /** Creates a session and returns the stored record. */
    create(
        userId: number,
        tokenHash: string,
        expiresAt: string,
    ) {
        this.db.prepare(`
            INSERT INTO sessions (
                user_id,
                token_hash,
                expires_at
            )
            VALUES (?, ?, ?)
        `).run(userId, tokenHash, expiresAt);

        return this.findByTokenHash(tokenHash);
    }

    /** Finds a session by its token hash. */
    findByTokenHash(tokenHash: string) {
        return this.db.prepare(`
            SELECT
                id,
                user_id,
                token_hash,
                expires_at,
                created_at
            FROM sessions
            WHERE token_hash = ?
        `).get(tokenHash) as {
            id: number;
            user_id: number;
            token_hash: string;
            expires_at: string;
            created_at: string;
        } | undefined;
    }

    /** Deletes the session with the given token hash. */
    deleteByTokenHash(tokenHash: string) {
        return this.db.prepare(`
            DELETE FROM sessions
            WHERE token_hash = ?
        `).run(tokenHash);
    }
}
