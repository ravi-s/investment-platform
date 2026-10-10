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


        if (!Number.isFinite(input.endingMarketValue)) {
            throw new Error("Ending market value must be finite");
        }

        if (input.endingMarketValue < 0) {
            throw new Error("Ending market value cannot be negative");
        }

        // Validate transactions before mapping so the non-null assertions below
        // are safe. Split records are exempt because they do not create cash flows.
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
            if (
                !Number.isFinite(transaction.quantity) ||
                transaction.quantity <= 0
            ) {
                throw new Error(
                    `${transaction.type} transaction quantity must be a finite number greater than zero`,
                );
            }

            if (
                !Number.isFinite(transaction.price) ||
                transaction.price <= 0
            ) {
                throw new Error(
                    `${transaction.type} transaction price must be a finite number greater than zero`,
                );
            }

        }
        // Validate dividend inputs before constructing cash flows.
        for (const dividend of input.dividends ?? []) {
            if (!Number.isFinite(dividend.amount) || dividend.amount <= 0) {
                throw new Error(
                    "Dividend amount must be a finite number greater than zero",
                );
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

        // Add dividends separately on their payment dates, preserving their
        // timing in the XIRR calculation instead of treating them as one total.
        if (input.dividends) {
            input.dividends.forEach((dividend) => {
                cashFlows.push({
                    date: dividend.paymentDate,
                    amount: dividend.amount,
                });
            });
        }

        // Add the ending market value as a final inflow on the valuation date,
        // representing what the investor could receive by liquidating the portfolio.
        cashFlows.push({
            date: input.valuationDate,
            amount: input.endingMarketValue,
        });

        return this.xirrService.calculate(cashFlows);
    }
}
