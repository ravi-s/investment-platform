import db from "../db/database.js";


export class SecurityRepository {

    findById(id: number) {
        return db
            .prepare(`
                SELECT id, name
                FROM securities
                WHERE id = ?
            `)
            .get(id);
    }

    findListing(exchangeCode: string, symbol: string) {
        return db
            .prepare(`
            SELECT
                securities.id AS security_id,
                securities.name AS security_name,
                exchanges.code AS exchange_code,
                listings.symbol AS symbol
            FROM listings
            JOIN securities
                ON listings.security_id = securities.id
            JOIN exchanges
                ON listings.exchange_id = exchanges.id
            WHERE exchanges.code = ?
              AND listings.symbol = ?
        `)
            .get(exchangeCode, symbol);
    }
}
