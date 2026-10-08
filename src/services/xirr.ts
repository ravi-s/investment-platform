export type XirrCashFlow = {
    date: string;
    amount: number;
};

const DAYS_PER_YEAR = 365;
const MAX_LOG_RATE = 512;

export class XirrService {
    /**
     * Finds the annualized rate that makes the dated cash flows' net present
     * value zero. Dates are measured from the first cash flow using a 365-day
     * year; both positive and negative amounts are required.
     */
    calculate(cashFlows: XirrCashFlow[]): number {
        if (cashFlows.length < 2) {
            throw new Error("XIRR requires at least two cash flows");
        }

        let hasPositiveCashFlow = false;
        let hasNegativeCashFlow = false;
        let largestAmount = 0;

        const flows = cashFlows.map((cashFlow) => {
            const date = new Date(cashFlow.date).getTime();

            if (!Number.isFinite(date) || !Number.isFinite(cashFlow.amount)) {
                throw new Error("XIRR cash flows require valid dates and amounts");
            }

            hasPositiveCashFlow ||= cashFlow.amount > 0;
            hasNegativeCashFlow ||= cashFlow.amount < 0;
            largestAmount = Math.max(largestAmount, Math.abs(cashFlow.amount));

            return {
                date,
                amount: cashFlow.amount,
            };
        });

        if (!hasPositiveCashFlow || !hasNegativeCashFlow) {
            throw new Error("XIRR requires both positive and negative cash flows");
        }

        const baseDate = flows[0]!.date;
        // Normalize amounts without changing the rate's root, and express each
        // date as a year fraction relative to the first cash flow.
        const datedFlows = flows.map((flow) => ({
            yearFraction:
                (flow.date - baseDate) /
                (DAYS_PER_YEAR * 24 * 60 * 60 * 1000),
            amount: flow.amount / largestAmount,
        }));

        if (datedFlows.every((flow) => flow.yearFraction === 0)) {
            throw new Error("XIRR requires cash flows on different dates");
        }

        // Solve for log(1 + rate), which keeps the rate above -100% by
        // construction and makes the discount factor exp(-time * logRate).
        const evaluateSign = (logRate: number): number => {
            const terms = datedFlows.map((flow) => ({
                exponent: -flow.yearFraction * logRate,
                amount: flow.amount,
            }));
            // Scale the terms by their largest exponent to avoid overflow
            // when testing extreme candidate rates.
            const largestExponent = Math.max(
                ...terms.map((term) => term.exponent)
            );
            const presentValue = terms.reduce(
                (total, term) =>
                    total +
                    term.amount *
                        Math.exp(term.exponent - largestExponent),
                0
            );

            return Math.sign(presentValue);
        };

        const initialSign = evaluateSign(0);

        if (initialSign === 0) {
            return 0;
        }

        let lower = 0;
        let upper = 0;
        let lowerSign = initialSign;
        let upperSign = initialSign;
        let bracketFound = false;

        // Expand symmetrically until the present value changes sign. That
        // gives bisection an interval containing a root without a guessed rate.
        for (let distance = 1; distance <= MAX_LOG_RATE; distance *= 2) {
            lower = -distance;
            lowerSign = evaluateSign(lower);
            if (lowerSign === 0 || lowerSign !== initialSign) {
                bracketFound = true;
                break;
            }

            upper = distance;
            upperSign = evaluateSign(upper);
            if (upperSign === 0 || upperSign !== initialSign) {
                bracketFound = true;
                break;
            }
        }

        if (!bracketFound) {
            throw new Error("XIRR calculation did not converge");
        }

        if (lowerSign === 0) {
            return Math.exp(lower) - 1;
        }
        if (upperSign === 0) {
            return Math.exp(upper) - 1;
        }

        // Keep the half-interval whose endpoints have opposite signs. This
        // needs no derivative estimate and preserves a bracket around the root.
        if (lowerSign === initialSign) {
            lower = 0;
            lowerSign = initialSign;
        } else {
            upper = 0;
            upperSign = initialSign;
        }

        for (let iteration = 0; iteration < 200; iteration += 1) {
            const midpoint = (lower + upper) / 2;
            const midpointSign = evaluateSign(midpoint);

            if (midpointSign === 0) {
                return Math.exp(midpoint) - 1;
            }

            if (midpointSign === lowerSign) {
                lower = midpoint;
                lowerSign = midpointSign;
            } else {
                upper = midpoint;
                upperSign = midpointSign;
            }
        }

        // Convert the solved log(1 + rate) back to the annualized rate.
        return Math.exp((lower + upper) / 2) - 1;
    }
}
