import type { Database } from "better-sqlite3";

export class PortfolioRepository {
    constructor(private readonly db: Database) { }
    create(userId: number, name: string) {
        const result = this.db
            .prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `)
            .run(userId, name);

        return this.findById(Number(result.lastInsertRowid));
    }

    findById(id: number) {
        return this.db
            .prepare(`
                SELECT id, user_id, name
                FROM portfolios
                WHERE id = ?
            `)
            .get(id);
    }

    findHoldings(portfolioId: number) {
        return this.db
            .prepare(`
                SELECT
                    holdings.id AS holding_id,
                    securities.id AS security_id,
                    securities.name AS security_name,
                    holdings.quantity AS quantity
                FROM holdings
                JOIN securities
                    ON holdings.security_id = securities.id
                WHERE holdings.portfolio_id = ?
                ORDER BY securities.name
            `)
            .all(portfolioId);
    }
}