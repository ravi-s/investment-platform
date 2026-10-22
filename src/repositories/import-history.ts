
import type Database from "better-sqlite3";

/** A persisted record of a transaction-file import. */
export type ImportHistory = {
    id: number;
    user_id: number;
    portfolio_id: number;
    content_hash: string;
    imported_at: string;
};

export class ImportHistoryRepository {
    constructor(private readonly db: Database.Database) { }

    /** Find an import record by its database ID. */
    findById(id: number): ImportHistory | undefined {
        return this.db
            .prepare(`
                SELECT
                    id,
                    user_id,
                    portfolio_id,
                    content_hash,
                    imported_at
                FROM transaction_imports
                WHERE id = ?
            `)
            .get(id) as ImportHistory | undefined;
    }

    /** Check whether this file's content was already imported for this user and portfolio. */
    exists(
        userId: number,
        portfolioId: number,
        contentHash: string
    ): boolean {
        const row = this.db
            .prepare(`
                SELECT 1 AS found
                FROM transaction_imports
                WHERE user_id = ?
                  AND portfolio_id = ?
                  AND content_hash = ?
                LIMIT 1
            `)
            .get(userId, portfolioId, contentHash) as
            | { found: number }
            | undefined;

        return row !== undefined;
    }

    /** Insert an import record, then return the persisted row. */
    create(
        userId: number,
        portfolioId: number,
        contentHash: string
    ): ImportHistory | undefined {
        const result = this.db
            .prepare(`
                INSERT INTO transaction_imports (
                    user_id,
                    portfolio_id,
                    content_hash
                )
                VALUES (?, ?, ?)
            `)
            .run(userId, portfolioId, contentHash);

        return this.findById(Number(result.lastInsertRowid));
    }
}
