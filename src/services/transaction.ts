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
    create(
        portfolioId: number,
        securityId: number,
        type: "BUY" | "SELL",
        quantity: number,
        price: number,
        transactionDate: string
    ) {
        if (quantity <= 0) {
            throw new Error("Quantity must be greater than 0");
        }

        if (price <= 0) {
            throw new Error("Price must be greater than 0");
        }

        const portfolio = portfolioRepository.findById(portfolioId);
        if (!portfolio) {
            throw new Error("Portfolio not found");
        }

        const security = securityRepository.findById(securityId);
        if (!security) {
            throw new Error("Security not found");
        }

        return db.transaction(() => {
            const transaction = transactionRepository.create(
                portfolioId,
                securityId,
                type,
                quantity,
                price,
                transactionDate
            );

            const holding = holdingRepository.findByPortfolioAndSecurity(
                portfolioId,
                securityId
            ); // as { id: number } | undefined;

            if (type === "BUY") {
                if (holding) {
                    holdingRepository.updateQuantity(holding.id, quantity);
                } else {
                    holdingRepository.create(
                        portfolioId,
                        securityId,
                        quantity
                    );
                }
            } else {
                if (!holding) {
                    throw new Error("Holding not found");
                }

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