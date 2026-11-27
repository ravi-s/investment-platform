
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
    source_file: string | null;
    source_row_number: number | null;
    isin: string | null;
    trade_id: string | null;
    order_id: string | null;
    transaction_id: number | null;
};

export type NewTransactionImportBatchItem = {
    source_row: number;
    transaction_date: string;
    security_id: number;
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
    source_file?: string | null;
    source_row_number?: number | null;
    isin?: string | null;
    trade_id?: string | null;
    order_id?: string | null;
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
                    price,
                    source_file,
                    source_row_number,
                    isin,
                    trade_id,
                    order_id,
                    transaction_id
                    
                FROM transaction_import_batch_items
                WHERE batch_id = ?
                ORDER BY source_row
            `)
            .all(batchId) as TransactionImportBatchItem[];
    }

    /**
     * Atomically associates an item with a transaction only if it is unassociated.
     * @param itemId The ID of the batch item to update.
     * @param transactionId The ID of the transaction to associate.
     * @throws If the item does not exist or is already associated. Database
     * constraint errors, such as an invalid or already-associated transaction,
     * also propagate to the caller.
     */
    associateWithTransaction(itemId: number, transactionId: number): void {
        const result = this.db
            .prepare(`
                UPDATE transaction_import_batch_items
                SET transaction_id = ?
                WHERE id = ?
                  AND transaction_id IS NULL
            `)
            .run(transactionId, itemId);

        if (result.changes !== 1) {
            throw new Error(
                `Failed to associate transaction import batch item ${itemId}: item not found or already associated`
            );
        }
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
                price,
                source_file,
                source_row_number,
                isin,
                trade_id,
                order_id
            )
            
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of items) {
                insert.run(
                    batchId,
                    item.source_row,
                    item.transaction_date,
                    item.security_id,
                    item.type,
                    item.quantity,
                    item.price,
                    item.source_file ?? null,
                    item.source_row_number ?? null,
                    item.isin ?? null,
                    item.trade_id ?? null,
                    item.order_id ?? null,
                );
            }

            return this.findByBatchId(batchId);
        })();
    }
}
