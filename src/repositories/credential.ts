import type Database from "better-sqlite3";

/** Provides database access for user credentials. */
export class CredentialRepository {
    constructor(private readonly db: Database.Database) { }

    /** Creates credentials for a user and returns the stored record. */
    create(userId: number, passwordHash: string) {
        this.db.prepare(`
            INSERT INTO user_credentials (user_id, password_hash)
            VALUES (?, ?)
        `).run(userId, passwordHash);

        return this.findByUserId(userId);
    }

    /** Finds a user's credentials, or returns undefined when none exist. */
    findByUserId(userId: number) {
        return this.db.prepare(`
            SELECT user_id, password_hash, created_at, updated_at
            FROM user_credentials
            WHERE user_id = ?
        `).get(userId) as {
            user_id: number;
            password_hash: string;
            created_at: string;
            updated_at: string;
        } | undefined;
    }
}
