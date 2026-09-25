import db from "../db/database.js";
import { HoldingRepository } from "../repositories/holding.js";
import { PortfolioRepository } from "../repositories/portfolio.js";
import { SecurityRepository } from "../repositories/security.js";
import { TransactionRepository } from "../repositories/transaction.js";

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

    findByPortfolioId(portfolioId: number) {
        return transactionRepository.findByPortfolioId(portfolioId);
    }
}