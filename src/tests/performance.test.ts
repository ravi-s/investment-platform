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
        expect(result.unrealizedGainPercent).toBe(10);
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
        expect(result.averageCost).toBeCloseTo(250000 / 120);
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

    it("calculates average cost for the remaining FIFO position", () => {
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

        expect(result.averageCost).toBeCloseTo(190000 / 90);
    });

    it("preserves a negative realized gain when selling at a loss", () => {
        const service = new PerformanceService();

        const result = service.calculate({
            transactions: [
                {
                    type: "BUY",
                    quantity: 10,
                    price: 100,
                },
                {
                    type: "SELL",
                    quantity: 10,
                    price: 80,
                },
            ],
            marketPrice: 80,
        });

        expect(result.realizedGain).toBe(-200);
        expect(result.quantity).toBe(0);
        expect(result.averageCost).toBe(0);
        expect(result.unrealizedGain).toBe(0);
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
    it("calculates FIFO correctly across multiple SELL transactions", () => {
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
                {
                    type: "SELL",
                    quantity: 50,
                    price: 2700,
                },
            ],
            marketPrice: 2600,
        });

        expect(result.quantity).toBe(40);
        expect(result.realizedGain).toBe(47000);
        expect(result.marketValue).toBe(104000);
        expect(result.unrealizedGain).toBe(14000);
    });

    it("preserves the remaining cost basis after a partial SELL at a loss", () => {
        const service = new PerformanceService();

        const result = service.calculate({
            transactions: [
                {
                    type: "BUY",
                    quantity: 10,
                    price: 100,
                },
                {
                    type: "SELL",
                    quantity: 4,
                    price: 80,
                },
            ],
            marketPrice: 120,
        });

        expect(result.realizedGain).toBe(-80);
        expect(result.quantity).toBe(6);
        expect(result.acquisitionCost).toBe(600);
        expect(result.unrealizedGain).toBe(120);
    });

    it("preserves the final FIFO lot when a SELL partially consumes it", () => {
        const service = new PerformanceService();

        const result = service.calculate({
            transactions: [
                {
                    type: "BUY",
                    quantity: 10,
                    price: 100,
                },
                {
                    type: "BUY",
                    quantity: 10,
                    price: 200,
                },
                {
                    type: "SELL",
                    quantity: 15,
                    price: 150,
                },
            ],
            marketPrice: 200,
        });

        expect(result.realizedGain).toBe(250);
        expect(result.quantity).toBe(5);
        expect(result.acquisitionCost).toBe(1000);
        expect(result.unrealizedGain).toBe(0);
    });

    it("removes an exactly exhausted FIFO lot and preserves the next lot", () => {
        const service = new PerformanceService();

        const result = service.calculate({
            transactions: [
                {
                    type: "BUY",
                    quantity: 10,
                    price: 100,
                },
                {
                    type: "BUY",
                    quantity: 10,
                    price: 200,
                },
                {
                    type: "SELL",
                    quantity: 10,
                    price: 150,
                },
            ],
            marketPrice: 200,
        });

        expect(result.realizedGain).toBe(500);
        expect(result.quantity).toBe(10);
        expect(result.acquisitionCost).toBe(2000);
        expect(result.marketValue).toBe(2000);
        expect(result.unrealizedGain).toBe(0);
    });

    it("calculates realized gain when a SELL exactly exhausts multiple lots", () => {
        const service = new PerformanceService();

        const result = service.calculate({
            transactions: [
                {
                    type: "BUY",
                    quantity: 10,
                    price: 100,
                },
                {
                    type: "BUY",
                    quantity: 10,
                    price: 200,
                },
                {
                    type: "SELL",
                    quantity: 20,
                    price: 150,
                },
            ],
            marketPrice: 150,
        });

        expect(result.realizedGain).toBe(0);
        expect(result.quantity).toBe(0);
        expect(result.unrealizedGain).toBe(0);
    });

    it("adjusts FIFO cost basis after a stock split", () => {
        const service = new PerformanceService();

        const result = service.calculate({
            transactions: [
                {
                    type: "BUY",
                    quantity: 10,
                    price: 100,
                },
                {
                    type: "SPLIT",
                    split_numerator: 2,
                    split_denominator: 1,
                },
                {
                    type: "SELL",
                    quantity: 10,
                    price: 60,
                },
            ],
            marketPrice: 60,
        });

        expect(result.quantity).toBe(10);
        expect(result.realizedGain).toBe(100);
        expect(result.acquisitionCost).toBe(500);
        expect(result.averageCost).toBe(50);
        expect(result.marketValue).toBe(600);
        expect(result.unrealizedGain).toBe(100);
    });

});