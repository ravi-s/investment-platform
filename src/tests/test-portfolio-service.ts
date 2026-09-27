import { PortfolioService } from "../services/portfolio.js";

const portfolioService = new PortfolioService();

console.log(
    "Portfolio valuation:",
    portfolioService.getPortfolioValuation(
        1,
        "2026-09-23",
        "NSE"
    )
);