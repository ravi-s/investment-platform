import { describe, it, expect } from "vitest";
import { MarketPriceService } from "../services/market-price.js";

describe("MarketPriceService", () => {
    const service = new MarketPriceService();

    it("creates a market price", () => {
        const result = service.create(
            "NSE",
            "RELIANCE",
            "2026-09-23",
            2650
        );

        expect(result).toBeDefined();
    });

    it("retrieves a market price by listing and date", () => {
        const result = service.findByListingAndDate(
            "NSE",
            "RELIANCE",
            "2026-09-23"
        );

        expect(result).toBeDefined();
        expect(result?.close_price).toBe(2650);
    });

    it("rejects a duplicate market price for the same listing and date", () => {
        expect(() =>
            service.create(
                "NSE",
                "RELIANCE",
                "2026-09-23",
                2655
            )
        ).toThrow();
    });

    it("rejects a non-positive close price", () => {
        expect(() =>
            service.create(
                "NSE",
                "RELIANCE",
                "2026-09-24",
                0
            )
        ).toThrow();
    });
});