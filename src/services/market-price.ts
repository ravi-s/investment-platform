import { SecurityRepository } from "../repositories/security.js";
import { MarketPriceRepository } from "../repositories/market-price.js";
import type Database from "better-sqlite3";


export class MarketPriceService {
    private marketPriceRepository: MarketPriceRepository;
    private securityRepository: SecurityRepository;

    constructor(db: Database.Database) {
        this.marketPriceRepository = new MarketPriceRepository(db);
        this.securityRepository = new SecurityRepository(db);
    }
    create(
        exchangeCode: string,
        symbol: string,
        priceDate: string,
        closePrice: number
    ) {
        if (closePrice <= 0) {
            throw new Error("Close price must be greater than 0");
        }

        const listing = this.securityRepository.findListing(
            exchangeCode,
            symbol
        ) as { listing_id: number } | undefined;

        if (!listing) {
            throw new Error("Listing not found");
        }

        return this.marketPriceRepository.create(
            listing.listing_id,
            priceDate,
            closePrice
        );
    }

    findByListingAndDate(
        exchangeCode: string,
        symbol: string,
        priceDate: string
    ) {
        const listing = this.securityRepository.findListing(
            exchangeCode,
            symbol
        ) as { listing_id: number } | undefined;

        if (!listing) {
            throw new Error("Listing not found");
        }

        return this.marketPriceRepository.findByListingAndDate(
            listing.listing_id,
            priceDate
        );
    }
}