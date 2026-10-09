import { XirrService } from "./xirr.js";

/** Describes a portfolio event used to build dated investment cash flows. */
type PortfolioTransaction = {
    /**
     * BUY and SELL transactions affect cash flow. SPLIT changes the share count
     * only, so it is excluded from the XIRR cash-flow series.
     */
    type: "BUY" | "SELL" | "SPLIT";
    /** Transaction date, passed unchanged to the XIRR calculation. */
    date: string;
    /** Number of shares involved in the transaction. */
    quantity: number;
    /** Price per share; split transactions do not contribute a cash flow. */
    price: number;
};

export class PortfolioPerformanceService {
    private readonly xirrService = new XirrService();

    /**
     * Calculates the portfolio's annualized return from its dated cash flows.
     * Purchases are represented as negative investor cash flows, while sales
     * and the ending portfolio valuation are positive cash flows. Split events
     * are ignored because they do not represent money entering or leaving the
     * investment.
     *
     * @param input Portfolio transactions and the ending valuation details.
     * @returns The annualized return produced by the XIRR service.
     */
    calculateXirr(input: {
        transactions: PortfolioTransaction[];
        valuationDate: string;
        endingMarketValue: number;
    }): number {
        // Convert each cash-affecting transaction to the investor's perspective:
        // buying shares spends money, whereas selling shares receives money.
        const cashFlows = input.transactions
            .filter((transaction) => transaction.type !== "SPLIT")
            .map((transaction) => ({
                date: transaction.date,
                amount:
                    transaction.type === "BUY"
                        ? -(transaction.quantity * transaction.price)
                        : transaction.quantity * transaction.price,
            }));

        // Treat the portfolio's market value on the valuation date as a final
        // inflow, representing the value an investor would receive on liquidation.
        cashFlows.push({
            date: input.valuationDate,
            amount: input.endingMarketValue,
        });

        return this.xirrService.calculate(cashFlows);
    }
}
