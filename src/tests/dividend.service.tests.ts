import { describe, it, expect } from "vitest";
import { DividendService } from "../services/dividend.js";

describe("DividendService", () => {
    it("calculates dividend income from eligible quantity", () => {
        const service = new DividendService();


        const result = service.calculate({
            eligibleQuantity: 70,
            amountPerUnit: 10,
        });

        expect(result).toBe(700);
    });

});
