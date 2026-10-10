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

    it("includes sale proceeds and the remaining portfolio value in XIRR", () => {
        const result = service.calculateXirr({
            transactions: [
                {
                    type: "BUY",
                    date: "2025-01-01",
                    quantity: 10,
                    price: 100,
                },
                {
                    type: "SELL",
                    date: "2025-07-01",
                    quantity: 4,
                    price: 120,
                },
            ],
            valuationDate: "2026-01-01",
            endingMarketValue: 780,
        });

        expect(result).toBeCloseTo(0.3353, 3);
    });

    it("does not treat a stock split as a cash flow", () => {
        const resultWithSplit = service.calculateXirr({
            transactions: [
                {
                    type: "BUY",
                    date: "2025-01-01",
                    quantity: 10,
                    price: 100,
                },
                {
                    type: "SPLIT",
                    date: "2025-07-01",
                    split_numerator: 2,
                    split_denominator: 1,
                },
            ],
            valuationDate: "2026-01-01",
            endingMarketValue: 1200,
        });

        const resultWithoutSplit = service.calculateXirr({
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

        expect(resultWithSplit).toBeCloseTo(resultWithoutSplit, 10);
    });

    it("calculates XIRR from multiple purchases on different dates", () => {
        const result = service.calculateXirr({
            transactions: [
                {
                    type: "BUY",
                    date: "2025-01-01",
                    quantity: 10,
                    price: 100,
                },
                {
                    type: "BUY",
                    date: "2025-07-01",
                    quantity: 5,
                    price: 120,
                },
            ],
            valuationDate: "2026-01-01",
            endingMarketValue: 1800,
        });

        expect(result).toBeCloseTo(0.15484, 4);
    });

    it("includes dividend income as a positive cash flow on the payment date", () => {
        const result = service.calculateXirr({
            transactions: [
                {
                    type: "BUY",
                    date: "2025-01-01",
                    quantity: 10,
                    price: 100,
                },
            ],
            dividends: [
                {
                    paymentDate: "2025-06-01",
                    amount: 100,
                },
            ],
            valuationDate: "2026-01-01",
            endingMarketValue: 1100,
        });

        expect(result).toBeCloseTo(0.211929, 5);
    });

    it("calculates the same XIRR when transactions are supplied in reverse chronological order", () => {
        const transactions = [
            {
                type: "BUY" as const,
                date: "2025-01-01",
                quantity: 10,
                price: 100,
            },
            {
                type: "BUY" as const,
                date: "2025-07-01",
                quantity: 5,
                price: 120,
            },
        ];

        const input = {
            valuationDate: "2026-01-01",
            endingMarketValue: 1800,
            dividends: [],
        };

        const chronologicalResult = service.calculateXirr({
            ...input,
            transactions,
        });

        const reverseChronologicalResult = service.calculateXirr({
            ...input,
            transactions: [...transactions].reverse(),
        });

        expect(reverseChronologicalResult).toBeCloseTo(
            chronologicalResult,
            10,
        );
    });

    it("preserves a dividend and purchase occurring on the same date", () => {
        const result = service.calculateXirr({
            transactions: [
                {
                    type: "BUY",
                    date: "2025-01-01",
                    quantity: 10,
                    price: 100,
                },
            ],
            dividends: [
                {
                    paymentDate: "2025-01-01",
                    amount: 100,
                },
            ],
            valuationDate: "2026-01-01",
            endingMarketValue: 1000,
        });

        expect(result).toBeCloseTo(0.1111, 3);
    });

    it("rejects a BUY transaction with a missing quantity", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [
                    {
                        type: "BUY",
                        date: "2025-01-01",
                        price: 100,
                    },
                ],
                valuationDate: "2026-01-01",
                endingMarketValue: 1200,
            }),
        ).toThrow("BUY transaction requires quantity and price");
    });

    it("rejects a BUY transaction with a negative quantity", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [
                    {
                        type: "BUY",
                        date: "2025-01-01",
                        quantity: -10,
                        price: 100,
                    },
                ],
                valuationDate: "2026-01-01",
                endingMarketValue: 1200,
            }),
        ).toThrow("BUY transaction quantity must be a finite number greater than zero");
    });

    it("rejects a negative ending market value", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [
                    {
                        type: "BUY",
                        date: "2025-01-01",
                        quantity: 10,
                        price: 100,
                    },
                ],
                valuationDate: "2026-01-01",
                endingMarketValue: -100,
            }),
        ).toThrow("Ending market value cannot be negative");
    });

    it("rejects a non-finite ending market value", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [
                    {
                        type: "BUY",
                        date: "2025-01-01",
                        quantity: 10,
                        price: 100,
                    },
                ],
                valuationDate: "2026-01-01",
                endingMarketValue: Number.NaN,
            }),
        ).toThrow("Ending market value must be finite");
    });

    it("rejects a non-finite ending market value even when there are no transactions", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [],
                valuationDate: "2026-01-01",
                endingMarketValue: Number.NaN,
            }),
        ).toThrow("Ending market value must be finite");
    });

    it("rejects an infinite transaction quantity", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [
                    {
                        type: "BUY",
                        date: "2025-01-01",
                        quantity: Number.POSITIVE_INFINITY,
                        price: 100,
                    },
                ],
                valuationDate: "2026-01-01",
                endingMarketValue: 1200,
            }),
        ).toThrow(
            "BUY transaction quantity must be a finite number greater than zero",
        );
    });

    it("rejects a zero dividend amount", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [
                    {
                        type: "BUY",
                        date: "2025-01-01",
                        quantity: 10,
                        price: 100,
                    },
                ],
                dividends: [
                    {
                        paymentDate: "2025-06-01",
                        amount: 0,
                    },
                ],
                valuationDate: "2026-01-01",
                endingMarketValue: 1200,
            }),
        ).toThrow(
            "Dividend amount must be a finite number greater than zero",
        );
    });

    it("rejects an invalid valuation date", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [
                    {
                        type: "BUY",
                        date: "2025-01-01",
                        quantity: 10,
                        price: 100,
                    },
                ],
                valuationDate: "2026-02-30",
                endingMarketValue: 1200,
            }),
        ).toThrow();
    });

    it("rejects an invalid transaction date", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [
                    {
                        type: "BUY",
                        date: "2026-02-30",
                        quantity: 10,
                        price: 100,
                    },
                ],
                valuationDate: "2026-12-31",
                endingMarketValue: 1200,
            }),
        ).toThrow("Invalid transaction date");
    });

    it("rejects an invalid dividend payment date", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [
                    {
                        type: "BUY",
                        date: "2025-01-01",
                        quantity: 10,
                        price: 100,
                    },
                ],
                dividends: [
                    {
                        paymentDate: "2026-02-30",
                        amount: 100,
                    },
                ],
                valuationDate: "2026-12-31",
                endingMarketValue: 1200,
            }),
        ).toThrow("Invalid dividend payment date");
    });


    it("rejects a SPLIT transaction with an invalid date", () => {
        expect(() =>
            service.calculateXirr({
                transactions: [
                    {
                        type: "SPLIT",
                        date: "2026-02-30",
                        split_numerator: 2,
                        split_denominator: 1,
                    },
                ],
                valuationDate: "2026-12-31",
                endingMarketValue: 1200,
            }),
        ).toThrow("Invalid transaction date");
    });

});
