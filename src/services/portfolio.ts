
import { PortfolioRepository } from "../repositories/portfolio.js";
import { UserRepository } from "../repositories/user.js";

import { TransactionService } from "./transaction.js";
import { SecurityRepository } from "../repositories/security.js";
import { MarketPriceRepository } from "../repositories/market-price.js";
import type Database from "better-sqlite3"; export class PortfolioService {
    private readonly transactionService: TransactionService;
    private readonly portfolioRepository: PortfolioRepository;
    private readonly userRepository: UserRepository;
    private readonly securityRepository: SecurityRepository;
    private readonly marketPriceRepository: MarketPriceRepository;

    constructor(db: Database.Database) {
        this.transactionService = new TransactionService(db);
        this.portfolioRepository = new PortfolioRepository(db);
        this.userRepository = new UserRepository();
        this.securityRepository = new SecurityRepository(db);
        this.marketPriceRepository = new MarketPriceRepository(db);
    }

    createPortfolio(userId: number, name: string) {
        const user = this.userRepository.findById(userId);

        if (!user) {
            return null;
        }

        return this.portfolioRepository.create(userId, name);
    }

    getPortfolio(id: number) {
        return this.portfolioRepository.findById(id);
    }

    getHoldings(portfolioId: number) {
        return this.portfolioRepository.findHoldings(portfolioId);
    }

    getHoldingsAsOf(portfolioId: number, date: string) {
        return this.transactionService.findSecuritiesHeldAsOf(
            portfolioId,
            date
        );
    }
    getPortfolioValuation(
        portfolioId: number,
        date: string,
        exchangeCode: string
    ) {
        const holdings = this.transactionService.findSecuritiesHeldAsOf(
            portfolioId,
            date
        );

        const positions = holdings.map((holding) => {
            const listing =
                this.securityRepository.findListingBySecurityAndExchange(
                    holding.security_id,
                    exchangeCode
                ) as { listing_id: number } | undefined;

            if (!listing) {
                throw new Error(
                    `Listing not found for security ${holding.security_id} on ${exchangeCode}`
                );
            }

            const price = this.marketPriceRepository.findByListingAndDate(
                listing.listing_id,
                date
            ) as {
                listing_id: number;
                price_date: string;
                close_price: number;
            } | undefined;

            if (!price) {
                throw new Error(
                    `Historical price not found for listing ${listing.listing_id} on ${date}`
                );
            }

            const marketValue =
                holding.quantity * price.close_price;

            return {
                security_id: holding.security_id,
                listing_id: listing.listing_id,
                quantity: holding.quantity,
                close_price: price.close_price,
                market_value: marketValue,
            };
        });

        const totalMarketValue = positions.reduce(
            (total, position) => total + position.market_value,
            0
        );

        return {
            portfolio_id: portfolioId,
            date,
            exchange: exchangeCode,
            positions,
            total_market_value: totalMarketValue,
        };
    }
}