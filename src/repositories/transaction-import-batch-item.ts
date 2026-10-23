
import type Database from "better-sqlite3";

export type TransactionImportBatchItem = {
    id: number;
    batch_id: number;
    source_row: number;
    transaction_date: string;
    security_id: number;
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
};

export type NewTransactionImportBatchItem = {
    source_row: number;
    transaction_date: string;
    security_id: number;
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
};

export class TransactionImportBatchItemRepository {
    /** Creates a repository backed by the provided SQLite database. */
    constructor(private readonly db: Database.Database) { }

    /**
     * Retrieves all items for a batch, ordered by source row.
     * @param batchId The ID of the batch to search.
     * @returns The matching items, or an empty array if none exist.
     */
    findByBatchId(batchId: number): TransactionImportBatchItem[] {
        return this.db
            .prepare(`
                SELECT
                    id,
                    batch_id,
                    source_row,
                    transaction_date,
                    security_id,
                    type,
                    quantity,
                    price
                FROM transaction_import_batch_items
                WHERE batch_id = ?
                ORDER BY source_row
            `)
            .all(batchId) as TransactionImportBatchItem[];
    }

    /**
     * Inserts multiple items for a batch atomically.
     * @param batchId The ID of the batch to associate with the items.
     * @param items The item data to insert.
     * @returns All items for the batch after insertion, or an empty array if
     * no items were provided.
     */
    createMany(
        batchId: number,
        items: NewTransactionImportBatchItem[]
    ): TransactionImportBatchItem[] {
        if (items.length === 0) {
            return [];
        }

        return this.db.transaction(() => {
            const insert = this.db.prepare(`
                INSERT INTO transaction_import_batch_items (
                    batch_id,
                    source_row,
                    transaction_date,
                    security_id,
                    type,
                    quantity,
                    price
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of items) {
                insert.run(
                    batchId,
                    item.source_row,
                    item.transaction_date,
                    item.security_id,
                    item.type,
                    item.quantity,
                    item.price
                );
            }

            return this.findByBatchId(batchId);
        })();
    }
}
