import { describe, it, expect } from "vitest";
import { PerformanceService } from "../services/performance.js";

describe("PerformanceService", () => {

    it("calculates unrealized gain for a simple BUY position", () => {
        const service = new PerformanceService();

        const result = service.calculate({
            transactions: [
                {
                    type: "BUY",
                    quantity: 100,
                    price: 2000,
                },
            ],
            marketPrice: 2200,
        });

        expect(result.marketValue).toBe(220000);
        expect(result.unrealizedGain).toBe(20000);
    });

    it("calculates unrealized gain from multiple BUY transactions", () => {
        const service = new PerformanceService();

        const result = service.calculate({
            transactions: [
                {
                    type: "BUY",
                    quantity: 100,
                    price: 2000,
                },
                {
                    type: "BUY",
                    quantity: 20,
                    price: 2500,
                },
            ],
            marketPrice: 2600,
        });

        expect(result.marketValue).toBe(312000);
        expect(result.unrealizedGain).toBe(62000);
    });

    it("calculates realized and unrealized gains using FIFO", () => {
        const service = new PerformanceService();

        const result = service.calculate({
            transactions: [
                {
                    type: "BUY",
                    quantity: 100,
                    price: 2000,
                },
                {
                    type: "BUY",
                    quantity: 20,
                    price: 2500,
                },
                {
                    type: "SELL",
                    quantity: 30,
                    price: 2400,
                },
            ],
            marketPrice: 2600,
        });

        expect(result.quantity).toBe(90);
        expect(result.realizedGain).toBe(12000);
        expect(result.marketValue).toBe(234000);
        expect(result.unrealizedGain).toBe(44000);
    });

    it("calculates FIFO when a SELL consumes multiple lots", () => {
        const service = new PerformanceService();

        const result = service.calculate({
            transactions: [
                {
                    type: "BUY",
                    quantity: 100,
                    price: 2000,
                },
                {
                    type: "BUY",
                    quantity: 20,
                    price: 2500,
                },
                {
                    type: "SELL",
                    quantity: 110,
                    price: 2400,
                },
            ],
            marketPrice: 2600,
        });

        expect(result.quantity).toBe(10);
        expect(result.realizedGain).toBe(39000);
        expect(result.marketValue).toBe(26000);
        expect(result.unrealizedGain).toBe(1000);
    });

});