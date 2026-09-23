import db from "../db/database.ts";


type Holding = {
    id: number;
    portfolio_id: number;
    security_id: number;
    quantity: number;
};
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



    findByPortfolioAndSecurity(
        portfolioId: number,
        securityId: number
    ): Holding | undefined {

        return db
            .prepare(`
          SELECT
            id,
            portfolio_id,
            security_id,
            quantity
          FROM holdings
          WHERE portfolio_id = ?
            AND security_id = ?
          `)
            .get(portfolioId, securityId) as Holding | undefined;
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

    updateQuantity(id: number, delta: number) {
        db.prepare(`
    UPDATE holdings
    SET quantity = quantity + ?
    WHERE id = ?
    `).run(delta, id);

        return this.findById(id);
    }
}