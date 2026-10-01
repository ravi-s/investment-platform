type Transaction = {
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
};

type Lot = {
    quantity: number;
    price: number;
};

/**
 * Calculates a portfolio's realized and unrealized performance from its
 * ordered transaction history.
 *
 * BUY transactions are retained as individual lots. SELL transactions use
 * the first available lot (FIFO), allowing a sale to consume one or more
 * lots. The class reports the remaining holdings, their original cost,
 * current market value, realized gains from completed sales, and unrealized
 * gains on holdings that remain open.
 */
export class PerformanceService {
    /**
     * Calculates portfolio performance at the supplied market price.
     *
     * Transactions must be processed in date-wise order. Each BUY adds a
     * lot at its transaction price. Each SELL is matched against existing lots
     * using FIFO; if the sale exceeds available holdings, an error is thrown.
     * Realized gain is the sale proceeds minus the acquisition cost of the
     * matched lots. For remaining lots, acquisition cost is compared with the
     * current market value to determine unrealized gain.
     *
     * @param input The transaction history and current market price.
     * @returns A summary of holdings, costs, values, and realized/unrealized
     *          gains.
     * @throws Error when a SELL transaction exceeds available holdings.
     */
    calculate(input: {
        transactions: Transaction[];
        marketPrice: number;
    }) {
        const lots: Lot[] = [];
        let realizedGain = 0;

        for (const transaction of input.transactions) {
            if (transaction.type === "BUY") {
                lots.push({
                    quantity: transaction.quantity,
                    price: transaction.price,
                });

                continue;
            }

            let remainingToSell = transaction.quantity;

            while (remainingToSell > 0) {
                const lot = lots[0];

                if (!lot) {
                    throw new Error(
                        "SELL quantity exceeds available holdings"
                    );
                }

                const matchedQuantity = Math.min(
                    remainingToSell,
                    lot.quantity
                );

                const acquisitionCost =
                    matchedQuantity * lot.price;

                const saleProceeds =
                    matchedQuantity * transaction.price;

                realizedGain +=
                    saleProceeds - acquisitionCost;

                lot.quantity -= matchedQuantity;
                remainingToSell -= matchedQuantity;

                if (lot.quantity === 0) {
                    lots.shift();
                }
            }
        }

        const quantity = lots.reduce(
            (total, lot) => total + lot.quantity,
            0
        );

        const acquisitionCost = lots.reduce(
            (total, lot) =>
                total + lot.quantity * lot.price,
            0
        );

        const averageCost =
            quantity === 0 ? 0 : acquisitionCost / quantity;

        const marketValue =
            quantity * input.marketPrice;

        const unrealizedGain =
            marketValue - acquisitionCost;

        const unrealizedGainPercent = acquisitionCost === 0 ? 0 : (unrealizedGain / acquisitionCost) * 100;

        return {
            quantity,
            acquisitionCost,
            averageCost,
            marketValue,
            realizedGain,
            unrealizedGain,
            unrealizedGainPercent,
        };
    }
}