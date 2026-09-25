import db from "../db/database.ts";

export class TransactionRepository {
    // Returns the persisted database representation for one transaction.
    findById(id: number) {
        return db
            .prepare(`
				SELECT
					id,
					portfolio_id,
					security_id,
					type,
					quantity,
					price,
					transaction_date
				FROM transactions
				WHERE id = ?
			`)
            .get(id);
    }

    // Keep a portfolio's transaction history in deterministic creation order.
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

        return db
            .prepare(`
				SELECT
					id,
					portfolio_id,
					security_id,
					type,
					quantity,
					price,
					transaction_date
				FROM transactions
				WHERE ${conditions.join(" AND ")}
				ORDER BY transaction_date DESC, id DESC
			`)
            .all(...params);
    }

    create(
        portfolioId: number,
        securityId: number,
        type: "BUY" | "SELL",
        quantity: number,
        price: number,
        transactionDate: string
    ) {
        const result = db
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
}
