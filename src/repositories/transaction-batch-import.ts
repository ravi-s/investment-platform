
import type Database from "better-sqlite3";

/** The lifecycle states allowed for a transaction import batch. */
export type TransactionImportBatchStatus =
    | "STAGED"
    | "APPLIED"
    | "REJECTED";

/** A persisted transaction import batch. */
export type TransactionImportBatch = {
    id: number;
    user_id: number;
    portfolio_id: number;
    content_hash: string;
    status: TransactionImportBatchStatus;
    created_at: string;
    applied_at: string | null;
};

/** Provides database access for transaction import batches. */
export class TransactionImportBatchRepository {
    constructor(private readonly db: Database.Database) { }

    /** Retrieves a batch by ID, or undefined when no row matches. */
    findById(batchId: number): TransactionImportBatch | undefined {
        return this.db
            .prepare(`
                SELECT
                    id,
                    user_id,
                    portfolio_id,
                    content_hash,
                    status,
                    created_at,
                    applied_at
                FROM transaction_import_batches
                WHERE id = ?
            `)
            .get(batchId) as TransactionImportBatch | undefined;
    }

    /** Creates a staged batch and returns its persisted row. */
    create(
        userId: number,
        portfolioId: number,
        contentHash: string
    ): TransactionImportBatch {
        const result = this.db
            .prepare(`
                INSERT INTO transaction_import_batches (
                    user_id,
                    portfolio_id,
                    content_hash
                )
                VALUES (?, ?, ?)
            `)
            .run(userId, portfolioId, contentHash);

        const batch = this.findById(Number(result.lastInsertRowid));

        if (batch === undefined) {
            throw new Error(
                "Created transaction import batch could not be found"
            );
        }

        return batch;
    }

    /**
     * Transitions a batch from STAGED to APPLIED or REJECTED.
     * Returns false if the batch does not exist or is no longer STAGED.
     */
    transitionStatus(
        batchId: number,
        status: "APPLIED" | "REJECTED"
    ): boolean {
        const result = this.db
            .prepare(`
                UPDATE transaction_import_batches
                SET
                    status = ?,
                    applied_at = CASE
                        WHEN ? = 'APPLIED' THEN datetime('now')
                        ELSE NULL
                    END
                WHERE id = ?
                  AND status = 'STAGED'
            `)
            .run(status, status, batchId);

        return result.changes > 0;
    }
}
