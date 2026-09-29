import type Database from "better-sqlite3";
// import db from "../db/database.js";

/**
 * Repository for managing market price records.
 * Persists and retrieves daily closing prices for listings.
 */
type MarketPriceRow = {
    id: number;
    listing_id: number;
    price_date: string;
    close_price: number;
};
export class MarketPriceRepository {
    constructor(private db: Database.Database) { }
    create(
        listingId: number,
        priceDate: string,
        closePrice: number
    ): MarketPriceRow {
        const result = this.db.prepare(`
            INSERT INTO market_prices (
                listing_id,
                price_date,
                close_price
            )
            VALUES (?, ?, ?)
        `).run(
            listingId,
            priceDate,
            closePrice
        );

        return {
            id: Number(result.lastInsertRowid),
            listing_id: listingId,
            price_date: priceDate,
            close_price: closePrice,
        };
    }

    findByListingAndDate(
        listingId: number,
        priceDate: string
    ): MarketPriceRow | undefined {
        return this.db.prepare(`
            SELECT *
            FROM market_prices
            WHERE listing_id = ?
              AND price_date = ?
        `).get(listingId, priceDate) as MarketPriceRow | undefined;
    }
}