
import type Database from "better-sqlite3";
import { HoldingRepository } from "../repositories/holding.js";
import { PortfolioRepository } from "../repositories/portfolio.js";
import { SecurityRepository } from "../repositories/security.js";
import db from "../db/database.js";

export class HoldingService {
    private readonly holdingRepository: HoldingRepository;
    private readonly portfolioRepository: PortfolioRepository;
    private readonly securityRepository: SecurityRepository;

    constructor(database: Database.Database = db) {
        this.holdingRepository = new HoldingRepository(database);
        this.portfolioRepository = new PortfolioRepository(database);
        this.securityRepository = new SecurityRepository(database);
    }

    create(
        portfolioId: number,
        securityId: number,
        quantity: number
    ) {
        if (quantity <= 0) {
            throw new Error("Quantity must be greater than 0");
        }

        const portfolio = this.portfolioRepository.findById(portfolioId);
        if (!portfolio) {
            throw new Error("Portfolio not found");
        }

        const security = this.securityRepository.findById(securityId);
        if (!security) {
            throw new Error("Security not found");
        }

        return this.holdingRepository.create(
            portfolioId,
            securityId,
            quantity
        );
    }

    findById(id: number) {
        return this.holdingRepository.findById(id);
    }

    findByPortfolioId(portfolioId: number) {
        return this.holdingRepository.findByPortfolioId(portfolioId);
    }

    findPortfolioById(portfolioId: number) {
        return this.portfolioRepository.findById(portfolioId);
    }
}
