import type Database from "better-sqlite3";

/** Provides database access for creating and retrieving transactions. */
export class TransactionRepository {
    /** Creates the repository with its SQLite database connection. */
    constructor(private readonly db: Database.Database) { }

    /** Retrieves a transaction by ID, or undefined when no row matches. */
    findById(id: number) {
        return this.db
            .prepare(`
                SELECT
                    id,
                    portfolio_id,
                    security_id,
                    type,
                    quantity,
                    price,
                    split_numerator,
                    split_denominator,
                    transaction_date
                FROM transactions
                WHERE id = ?
            `)
            .get(id);
    }

    /**
     * Lists a portfolio's transactions within optional inclusive date bounds.
     * Results are ordered newest first, with IDs providing a stable tie-breaker.
     */
    findByPortfolioId(portfolioId: number, from?: string, to?: string) {
        const conditions = ["portfolio_id = ?"];
        const params: (number | string)[] = [portfolioId];

        if (from !== undefined) {
            conditions.push("transaction_date >= ?");
            params.push(from);
        }

        if (to !== undefined) {
            conditions.push("transaction_date <= ?");
            params.push(to);
        }

        return this.db
            .prepare(`
                SELECT
                    id,
                    portfolio_id,
                    security_id,
                    type,
                    quantity,
                    price,
                    split_numerator,
                    split_denominator,
                    transaction_date
                FROM transactions
                WHERE ${conditions.join(" AND ")}
                ORDER BY transaction_date DESC, id DESC
            `)
            .all(...params);
    }

    /** Inserts a buy or sell transaction and returns its persisted row. */
    create(
        portfolioId: number,
        securityId: number,
        type: "BUY" | "SELL",
        quantity: number,
        price: number,
        transactionDate: string
    ) {
        const result = this.db
            .prepare(`
                INSERT INTO transactions (
                    portfolio_id,
                    security_id,
                    type,
                    quantity,
                    price,
                    transaction_date
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `)
            .run(
                portfolioId,
                securityId,
                type,
                quantity,
                price,
                transactionDate
            );

        // Reload the row so create returns the same shape as repository reads.
        return this.findById(Number(result.lastInsertRowid));
    }

    /** Inserts a split transaction and returns its persisted row. */
    createSplit(
        portfolioId: number,
        securityId: number,
        numerator: number,
        denominator: number,
        transactionDate: string
    ) {
        const result = this.db
            .prepare(`
                INSERT INTO transactions (
                    portfolio_id,
                    security_id,
                    type,
                    split_numerator,
                    split_denominator,
                    transaction_date
                )
                VALUES (?, ?, 'SPLIT', ?, ?, ?)
            `)
            .run(
                portfolioId,
                securityId,
                numerator,
                denominator,
                transactionDate
            );

        return this.findById(Number(result.lastInsertRowid));
    }
}