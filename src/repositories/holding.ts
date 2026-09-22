import db from "../db/database.ts";

export class HoldingRepository {
    findById(id: number) {
        return db
            .prepare(`
        SELECT
          id,
          portfolio_id,
          security_id,
          quantity
        FROM holdings
        WHERE id = ?
      `)
            .get(id);
    }

    findByPortfolioId(portfolioId: number) {
        return db
            .prepare(`
        SELECT
          id,
          portfolio_id,
          security_id,
          quantity
        FROM holdings
        WHERE portfolio_id = ?
        ORDER BY id
      `)
            .all(portfolioId);
    }

    create(
        portfolioId: number,
        securityId: number,
        quantity: number
    ) {
        const result = db
            .prepare(`
        INSERT INTO holdings (
          portfolio_id,
          security_id,
          quantity
        )
        VALUES (?, ?, ?)
      `)
            .run(portfolioId, securityId, quantity);

        return this.findById(Number(result.lastInsertRowid));
    }
}