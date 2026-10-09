import { describe, it, expect } from "vitest";
import { XirrService } from "../services/xirr.js";

describe("XirrService", () => {
    it("calculates XIRR for a one-year investment", () => {
        const service = new XirrService();

        const result = service.calculate([
            {
                date: "2026-01-01",
                amount: -100000,
            },
            {
                date: "2027-01-01",
                amount: 110000,
            },
        ]);

        expect(result).toBeCloseTo(0.10, 10);
    });

    it("calculates XIRR for a one-year loss", () => {
        const service = new XirrService();

        const result = service.calculate([
            {
                date: "2026-01-01",
                amount: -100000,
            },
            {
                date: "2027-01-01",
                amount: 90000,
            },
        ]);

        expect(result).toBeCloseTo(-0.10, 10);
    });

    it("calculates XIRR with an additional investment during the period", () => {
        const service = new XirrService();

        const result = service.calculate([
            {
                date: "2026-01-01",
                amount: -100000,
            },
            {
                date: "2026-07-01",
                amount: -50000,
            },
            {
                date: "2027-01-01",
                amount: 165000,
            },
        ]);

        expect(result).toBeCloseTo(0.120487, 6);
    });

    it("calculates the same XIRR regardless of cash-flow order", () => {
        const service = new XirrService();

        const chronologicalResult = service.calculate([
            {
                date: "2026-01-01",
                amount: -100000,
            },
            {
                date: "2026-07-01",
                amount: -50000,
            },
            {
                date: "2027-01-01",
                amount: 165000,
            },
        ]);

        const unorderedResult = service.calculate([
            {
                date: "2027-01-01",
                amount: 165000,
            },
            {
                date: "2026-01-01",
                amount: -100000,
            },
            {
                date: "2026-07-01",
                amount: -50000,
            },
        ]);

        expect(unorderedResult).toBeCloseTo(chronologicalResult, 10);
    });

    it("calculates XIRR with multiple investments and a partial redemption", () => {
        const service = new XirrService();

        const result = service.calculate([
            {
                date: "2026-01-01",
                amount: -100000,
            },
            {
                date: "2026-07-01",
                amount: -50000,
            },
            {
                date: "2026-10-01",
                amount: 30000,
            },
            {
                date: "2027-01-01",
                amount: 135000,
            },
        ]);

        expect(result).toBeCloseTo(0.127955, 6);
    });

    it("calculates XIRR for an investment held for six months", () => {
        const service = new XirrService();

        const result = service.calculate([
            {
                date: "2026-01-01",
                amount: -100000,
            },
            {
                date: "2026-07-01",
                amount: 105000,
            },
        ]);

        expect(result).toBeCloseTo(0.103392, 6);
    });

    it("calculates zero XIRR when the investment value is unchanged", () => {
        const service = new XirrService();

        const result = service.calculate([
            {
                date: "2026-01-01",
                amount: -100000,
            },
            {
                date: "2027-01-01",
                amount: 100000,
            },
        ]);

        expect(result).toBeCloseTo(0, 10);
    });
    it("rejects cash flows without both investment and receipt", () => {
        const service = new XirrService();

        expect(() =>
            service.calculate([
                {
                    date: "2026-01-01",
                    amount: -100000,
                },
                {
                    date: "2027-01-01",
                    amount: -10000,
                },
            ]),
        ).toThrow("XIRR requires both positive and negative cash flows");
    });

    it("rejects fewer than two cash flows", () => {
        const service = new XirrService();

        expect(() =>
            service.calculate([
                {
                    date: "2026-01-01",
                    amount: -100000,
                },
            ]),
        ).toThrow("XIRR requires at least two cash flows");
    });

    it("rejects invalid cash-flow dates", () => {
        const service = new XirrService();

        expect(() =>
            service.calculate([
                {
                    date: "not-a-date",
                    amount: -100000,
                },
                {
                    date: "2027-01-01",
                    amount: 110000,
                },
            ]),
        ).toThrow("XIRR cash flows require valid dates and amounts");
    });

    it("rejects invalid cash-flow amounts", () => {
        const service = new XirrService();

        expect(() =>
            service.calculate([
                {
                    date: "2026-01-01",
                    amount: Number.NaN,
                },
                {
                    date: "2027-01-01",
                    amount: 110000,
                },
            ]),
        ).toThrow("XIRR cash flows require valid dates and amounts");
    });

    it("rejects cash flows occurring on the same date", () => {
        const service = new XirrService();

        expect(() =>
            service.calculate([
                {
                    date: "2026-01-01",
                    amount: -100000,
                },
                {
                    date: "2026-01-01",
                    amount: 110000,
                },
            ]),
        ).toThrow("XIRR requires cash flows on different dates");
    });

    it("calculates XIRR with multiple investments and a final portfolio value", () => {
        const service = new XirrService();

        const result = service.calculate([
            {
                date: "2026-01-01",
                amount: -100000,
            },
            {
                date: "2026-04-01",
                amount: -25000,
            },
            {
                date: "2026-08-01",
                amount: -50000,
            },
            {
                date: "2027-01-01",
                amount: 190000,
            },
        ]);

        expect(result).toBeCloseTo(0.107966, 6);
    });

    it("calculates the same XIRR when all cash flows are scaled by the same factor", () => {
        const service = new XirrService();

        const cashFlows = [
            { date: "2026-01-01", amount: -100000 },
            { date: "2026-07-01", amount: -50000 },
            { date: "2027-01-01", amount: 165000 },
        ];

        const originalResult = service.calculate(cashFlows);

        const scaledResult = service.calculate(
            cashFlows.map((cashFlow) => ({
                ...cashFlow,
                amount: cashFlow.amount * 1000,
            })),
        );

        expect(scaledResult).toBeCloseTo(originalResult, 10);
    });


    it("calculates the same XIRR for very small cash flows", () => {
        const service = new XirrService();

        const cashFlows = [
            { date: "2026-01-01", amount: -0.1 },
            { date: "2026-07-01", amount: -0.05 },
            { date: "2027-01-01", amount: 0.165 },
        ];

        const result = service.calculate(cashFlows);

        const expected = service.calculate([
            { date: "2026-01-01", amount: -100000 },
            { date: "2026-07-01", amount: -50000 },
            { date: "2027-01-01", amount: 165000 },
        ]);

        expect(result).toBeCloseTo(expected, 10);
    });



});