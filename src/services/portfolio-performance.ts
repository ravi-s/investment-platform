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
    quantity?: number;
    /** Price per share; split transactions do not contribute a cash flow. */
    price?: number;
    split_numerator?: number;
    split_denominator?: number;
};

type PortfolioDividend = {
    /** Dividend payment date, passed unchanged to the XIRR calculation. */
    paymentDate: string;
    /** Dividend amount received by the investor. */
    amount: number;
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
        dividends?: PortfolioDividend[];
        valuationDate: string;
        endingMarketValue: number;
    }): number {

        // Validate before mapping so the non-null assertions below are backed
        // by an explicit check, while split records remain exempt from prices.
        for (const transaction of input.transactions) {
            if (transaction.type === "SPLIT") {
                continue;
            }

            if (
                transaction.quantity === undefined ||
                transaction.price === undefined
            ) {
                throw new Error(
                    `${transaction.type} transaction requires quantity and price`,
                );
            }
            if (transaction.quantity <= 0) {
                throw new Error(
                    `${transaction.type} transaction quantity must be greater than zero`,
                );
            }

            if (transaction.price <= 0) {
                throw new Error(
                    `${transaction.type} transaction price must be greater than zero`,
                );
            }
            if (input.endingMarketValue < 0) {
                throw new Error("Ending market value cannot be negative");
            }
        }

        // Convert each cash-affecting transaction to the investor's perspective:
        // buying shares spends money, whereas selling shares receives money.
        const cashFlows = input.transactions
            .filter((transaction) => transaction.type !== "SPLIT")
            .map((transaction) => ({
                date: transaction.date,
                // Quantity and price are guaranteed by the validation above.
                amount:
                    transaction.type === "BUY"
                        ? -(transaction.quantity! * transaction.price!)
                        : transaction.quantity! * transaction.price!,
            }));

        // Include dividends as positive cash flows on their payment dates.
        if (input.dividends) {
            input.dividends.forEach((dividend) => {
                cashFlows.push({
                    date: dividend.paymentDate,
                    amount: dividend.amount,
                });
            });
        }

        // Treat the portfolio's market value on the valuation date as a final
        // inflow, representing the value an investor would receive on liquidation.
        cashFlows.push({
            date: input.valuationDate,
            amount: input.endingMarketValue,
        });

        return this.xirrService.calculate(cashFlows);
    }
}
