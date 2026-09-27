import { PortfolioRepository } from "../repositories/portfolio.js";
import { UserRepository } from "../repositories/user.js";

import { TransactionService } from "./transaction.js";

const transactionService = new TransactionService();
const portfolioRepository = new PortfolioRepository();
const userRepository = new UserRepository();

export class PortfolioService {
    createPortfolio(userId: number, name: string) {
        const user = userRepository.findById(userId);

        if (!user) {
            return null;
        }

        return portfolioRepository.create(userId, name);
    }

    getPortfolio(id: number) {
        return portfolioRepository.findById(id);
    }

    getHoldings(portfolioId: number) {
        return portfolioRepository.findHoldings(portfolioId);
    }

    getHoldingsAsOf(portfolioId: number, date: string) {
        return transactionService.findSecuritiesHeldAsOf(
            portfolioId,
            date
        );
    }
}