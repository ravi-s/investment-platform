import db from "../db/database.js";
import { HoldingRepository } from "../repositories/holding.js";
import { PortfolioRepository } from "../repositories/portfolio.js";
import { SecurityRepository } from "../repositories/security.js";
import { TransactionRepository } from "../repositories/transaction.js";
import { previousDate } from "../utils/date.js";

const transactionRepository = new TransactionRepository();
const holdingRepository = new HoldingRepository();
const portfolioRepository = new PortfolioRepository();
const securityRepository = new SecurityRepository();

export class TransactionService {
    /**
     * Creates a transaction and updates the corresponding holding atomically.
     *
     * Validation and portfolio/security lookups happen before opening the
     * database transaction because they do not mutate state. All operations
     * that can leave related records inconsistent are performed inside the
     * transaction callback; if any operation throws, the transaction is
     * rolled back and neither the transaction nor holding changes persist.
     *
     * BUY transactions increase an existing holding or create one when the
     * investor does not currently own the security. SELL transactions require
     * an existing holding and reject quantities greater than the available
     * balance. A quantity equal to the holding balance is allowed; the
     * repository is responsible for persisting the resulting zero quantity.
     *
     * Keep the transaction creation and holding update in the same database
     * transaction. Splitting these operations could produce a transaction
     * history that does not match the current portfolio position.
     */
    create(
        portfolioId: number,
        securityId: number,
        type: "BUY" | "SELL",
        quantity: number,
        price: number,
        transactionDate: string
    ) {
        // Reject invalid economic values before touching the database. Zero
        // or negative values would make the holding balance ambiguous and
        // should never be represented as a trade.
        if (quantity <= 0) {
            throw new Error("Quantity must be greater than 0");
        }

        if (price <= 0) {
            throw new Error("Price must be greater than 0");
        }

        // Verify referenced entities before starting the write transaction so
        // callers receive domain-specific errors instead of repository or
        // foreign-key errors.
        const portfolio = portfolioRepository.findById(portfolioId);
        if (!portfolio) {
            throw new Error("Portfolio not found");
        }

        const security = securityRepository.findById(securityId);
        if (!security) {
            throw new Error("Security not found");
        }

        return db.transaction(() => {
            // The transaction record is created before the holding is changed
            // so both records are committed or rolled back together.
            const transaction = transactionRepository.create(
                portfolioId,
                securityId,
                type,
                quantity,
                price,
                transactionDate
            );

            // Read the position inside the database transaction. This keeps
            // the decision to create or update a holding in the same atomic
            // unit as the write operations below.
            const holding = holdingRepository.findByPortfolioAndSecurity(
                portfolioId,
                securityId
            );

            if (type === "BUY") {
                if (holding) {
                    // Repository quantities are adjusted by a delta rather
                    // than replacing the stored balance.
                    holdingRepository.updateQuantity(holding.id, quantity);
                } else {
                    // The first purchase establishes the portfolio/security
                    // position and its initial quantity.
                    holdingRepository.create(
                        portfolioId,
                        securityId,
                        quantity
                    );
                }
            } else {
                // A sale cannot create a position and must never reduce a
                // holding below zero. These checks also provide stable domain
                // errors for API consumers.
                if (!holding) {
                    throw new Error("Holding not found");
                }

                if (quantity > holding.quantity) {
                    throw new Error("Insufficient holding");
                }

                // Pass a negative delta for SELL so the repository decreases
                // the existing quantity by the amount sold.
                holdingRepository.updateQuantity(holding.id, -quantity);
            }

            return transaction;
        })();
    }

    findById(id: number) {
        return transactionRepository.findById(id);
    }

    findByPortfolioId(portfolioId: number, from?: string, to?: string) {
        // Date-only strings compare correctly lexicographically (YYYY-MM-DD).
        if (from !== undefined && to !== undefined && from > to) {
            throw new Error("Invalid date range");
        }

        return transactionRepository.findByPortfolioId(portfolioId, from, to);
    }

    getHoldingAsOf(
        portfolioId: number,
        securityId: number,
        date: string
    ): number {
        // Include all transactions through the requested date so the result
        // represents the security's balance at the end of that day.
        const transactions = transactionRepository.findByPortfolioId(
            portfolioId,
            undefined,
            date
        );

        let quantity = 0;

        // Apply only transactions for the requested security. Reversing the
        // repository result preserves chronological balance reconstruction.
        for (const transaction of [...transactions].reverse() as Array<{
            security_id: number;
            type: "BUY" | "SELL";
            quantity: number;
        }>) {
            if (transaction.security_id !== securityId) {
                continue;
            }

            if (transaction.type === "BUY") {
                quantity += transaction.quantity;
            } else {
                quantity -= transaction.quantity;
            }
        }

        // Return the net quantity held after all applicable transactions.
        return quantity;
    }

    getHoldingChange(
        portfolioId: number,
        securityId: number,
        from: string,
        to: string
    ): number {
        // A change can only be calculated across a valid, chronological range.
        if (from > to) {
            throw new Error("Invalid date range");
        }

        // Get the balance immediately before the range starts. Using the
        // previous date keeps transactions on `from` inside the calculation.
        const beforeStart = this.getHoldingAsOf(
            portfolioId,
            securityId,
            previousDate(from)
        );

        // Get the balance at the end of the range, including transactions on
        // the `to` date.
        const atEnd = this.getHoldingAsOf(
            portfolioId,
            securityId,
            to
        );

        // The difference between the ending and starting balances is the net
        // holding change during the requested period.
        return atEnd - beforeStart;
    }

    /** Returns transactions for a portfolio and 
     * security within an optional date range. 
     * 
     * */
    findTransactionsForSecurity(
        portfolioId: number,
        securityId: number,
        from?: string,
        to?: string
    ) {
        const transactions = transactionRepository.findByPortfolioId(
            portfolioId,
            from,
            to
        );

        return (transactions as Array<{ security_id: number }>).filter(
            (transaction) => transaction.security_id === securityId
        );
    }

    /**
     * Returns each security with a positive holding in the portfolio as of the
     * given date, along with its calculated quantity.
     */
    findSecuritiesHeldAsOf(
        portfolioId: number,
        date: string
    ) {
        const transactions = transactionRepository.findByPortfolioId(
            portfolioId,
            undefined,
            date
        ) as Array<{ security_id: number; type: string; quantity: number }>;

        // Reconstruct holdings using transactions dated on or before the requested date.
        const quantities = new Map<number, number>();

        // Apply transactions in chronological order: buys increase holdings,
        // while other transaction types decrease them.
        for (const transaction of [...transactions].reverse()) {
            const currentQuantity = quantities.get(transaction.security_id) ?? 0;

            if (transaction.type === "BUY") {
                quantities.set(
                    transaction.security_id,
                    currentQuantity + transaction.quantity
                );
            } else {
                quantities.set(
                    transaction.security_id,
                    currentQuantity - transaction.quantity
                );
            }
        }

        return Array.from(quantities.entries())
            .filter(([, quantity]) => quantity > 0)
            .map(([security_id, quantity]) => ({
                security_id,
                quantity,
            }));
    }
}