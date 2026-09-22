import { PortfolioRepository } from "../repositories/portfolio.js";
import { HoldingRepository } from "../repositories/holding.js";
import { SecurityRepository } from "../repositories/security.js";

const holdingRepository = new HoldingRepository();
const portfolioRepository = new PortfolioRepository();
const securityRepository = new SecurityRepository();

export class HoldingService {

    create(
        portfolioId: number,
        securityId: number,
        quantity: number
    ) {
        if (quantity <= 0) {
            throw new Error("Quantity must be greater than 0");
        }

        const portfolio = portfolioRepository.findById(portfolioId);
        if (!portfolio) {
            throw new Error("Portfolio not found");
        }

        const security = securityRepository.findById(securityId);
        if (!security) {
            throw new Error("Security not found");
        }

        return holdingRepository.create(
            portfolioId,
            securityId,
            quantity
        );
    }

    findById(id: number) {
        return holdingRepository.findById(id);
    }

    findByPortfolioId(portfolioId: number) {
        return holdingRepository.findByPortfolioId(portfolioId);
    }
}