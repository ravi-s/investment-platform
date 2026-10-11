import { InvestmentEventRepository } from "../repositories/investment-event.js";
import { TransactionService } from "./transaction.js";
import { DividendService } from "./dividend.js";

/**
 * Service responsible for deriving portfolio-level income from investment events,
 * especially dividend-related events.
 *
 * It acts as the orchestration layer between the repository, transaction history,
 * and the dividend calculation rules.
 */
export class InvestmentEventService {
    constructor(
        private readonly investmentEventRepository: InvestmentEventRepository,
        private readonly transactionService: TransactionService,
        private readonly dividendService: DividendService
    ) { }

    /**
     * Computes the dividend income attributable to a portfolio for a specific
     * investment event.
     *
     * Flow:
     * 1. Load the investment event by id.
     * 2. Resolve the portfolio's eligible holding quantity as of the event date.
     * 3. Apply the dividend formula using the per-unit amount.
     *
     * @throws Error when the investment event does not exist.
     */
    calculateDividendIncome(input: {
        portfolioId: number;
        investmentEventId: number;
    }): number {
        const event = this.investmentEventRepository.findById(
            input.investmentEventId
        );

        if (!event) {
            throw new Error("Investment event not found");
        }

        const eligibleQuantity = this.transactionService.getHoldingAsOf(
            input.portfolioId,
            event.security_id,
            event.record_date
        );

        return this.dividendService.calculate({
            eligibleQuantity,
            amountPerUnit: event.amount_per_unit,
        });
    }

    /**
     * Returns dividend cash flows for the portfolio.
     * The payment-date cutoff is applied by PortfolioPerformanceService.
     */
    getDividendCashFlows(portfolioId: number): Array<{
        paymentDate: string;
        amount: number;
    }> {
        return this.investmentEventRepository
            .findDividendEventsByPortfolioId(portfolioId)
            .map((event) => ({
                paymentDate: event.payment_date,
                amount: this.calculateDividendIncome({
                    portfolioId,
                    investmentEventId: event.id,
                }),
            }))
            // A portfolio may have traded a security without holding it
            // on the dividend's record date. Such an event pays nothing.
            .filter((dividend) => dividend.amount > 0);
    }

}