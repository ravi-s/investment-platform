import { SecurityRepository } from "../repositories/security.js";
import { MarketPriceRepository } from "../repositories/market-price.js";
import db from "../db/database.js";
const marketPriceRepository = new MarketPriceRepository();
const securityRepository = new SecurityRepository(db);

export class MarketPriceService {
    create(
        exchangeCode: string,
        symbol: string,
        priceDate: string,
        closePrice: number
    ) {
        if (closePrice <= 0) {
            throw new Error("Close price must be greater than 0");
        }

        const listing = securityRepository.findListing(
            exchangeCode,
            symbol
        ) as { listing_id: number } | undefined;

        if (!listing) {
            throw new Error("Listing not found");
        }

        return marketPriceRepository.create(
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
        const listing = securityRepository.findListing(
            exchangeCode,
            symbol
        ) as { listing_id: number } | undefined;

        if (!listing) {
            throw new Error("Listing not found");
        }

        return marketPriceRepository.findByListingAndDate(
            listing.listing_id,
            priceDate
        );
    }
}