//import db from "../db/database.js";
import type Database from "better-sqlite3";

type SecurityRow = {
    id: number;
    name: string;
};

type SecurityListingRow = {
    security_id: number;
    security_name: string;
    exchange_code: string;
    listing_id: number;
    symbol: string;
};
export class SecurityRepository {
    constructor(private readonly db: Database.Database) { }

    findById(id: number) {
        return this.db
            .prepare(`
                SELECT id, name
                FROM securities
                WHERE id = ?
            `)
            .get(id) as SecurityRow | undefined;
    }

    findListing(exchangeCode: string, symbol: string) {
        return this.db
            .prepare(`
            SELECT
                securities.id AS security_id,
                securities.name AS security_name,
                exchanges.code AS exchange_code,
                listings.id AS listing_id,
                listings.symbol AS symbol
            FROM listings
            JOIN securities
                ON listings.security_id = securities.id
            JOIN exchanges
                ON listings.exchange_id = exchanges.id
            WHERE exchanges.code = ?
              AND listings.symbol = ?
        `)
            .get(exchangeCode, symbol) as SecurityListingRow | undefined;
    }

    findListingBySecurityAndExchange(
        securityId: number,
        exchangeCode: string
    ) {
        return this.db
            .prepare(`
            SELECT
                securities.id AS security_id,
                securities.name AS security_name,
                exchanges.code AS exchange_code,
                listings.id AS listing_id,
                listings.symbol AS symbol
            FROM listings
            JOIN securities
                ON listings.security_id = securities.id
            JOIN exchanges
                ON listings.exchange_id = exchanges.id
            WHERE listings.security_id = ?
              AND exchanges.code = ?
        `)
            .get(securityId, exchangeCode) as SecurityListingRow | undefined;
    }
}
