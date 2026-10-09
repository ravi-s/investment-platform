import { describe, it, expect } from "vitest";
import { PortfolioPerformanceService } from "../services/portfolio-performance.js";

describe("PortfolioPerformanceService", () => {
    const service = new PortfolioPerformanceService();

    it("calculates XIRR from a purchase and ending portfolio value", () => {
        const result = service.calculateXirr({
            transactions: [
                {
                    type: "BUY",
                    date: "2025-01-01",
                    quantity: 10,
                    price: 100,
                },
            ],
            valuationDate: "2026-01-01",
            endingMarketValue: 1200,
        });

        expect(result).toBeCloseTo(0.2, 6);
    });
});
