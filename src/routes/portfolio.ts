import { type FastifyInstance } from "fastify";
import { z } from "zod";
import { PortfolioService } from "../services/portfolio.js";
import db from "../db/database.ts";
import { DateOnlySchema } from "../schema/date.ts";

import { TransactionService } from "../services/transaction.js";
import { PortfolioPerformanceService } from "../services/portfolio-performance.js";

import { InvestmentEventRepository } from "../repositories/investment-event.js";
import { InvestmentEventService } from "../services/investment-event.js";
import { DividendService } from "../services/dividend.js";

import { SessionService } from "../services/session.js";
import { authenticationGuard } from "./authentication-guard.js";

const CreatePortfolioSchema = z.object({
    userId: z.number().int().positive(),
    name: z.string().min(1),
});

const PortfolioHistoryQuerySchema = z.object({
    date: DateOnlySchema,
});

const PortfolioValuationQuerySchema = z.object({
    date: PortfolioHistoryQuerySchema.shape.date,
    exchange: z.string().min(1),
});

type PortfolioRouteOptions = {
    portfolioService?: PortfolioService;
    transactionService?: TransactionService;
    performanceService?: PortfolioPerformanceService;
    investmentEventService?: InvestmentEventService;
    sessionService?: SessionService;
};

export async function portfolioRoutes(
    app: FastifyInstance,
    options: PortfolioRouteOptions = {}
) {
    const portfolioService =
        options.portfolioService ?? new PortfolioService(db);

    const transactionService =
        options.transactionService ?? new TransactionService(db);

    const performanceService =
        options.performanceService ?? new PortfolioPerformanceService();

    const investmentEventService =
        options.investmentEventService ??
        new InvestmentEventService(
            new InvestmentEventRepository(db),
            transactionService,
            new DividendService(),
        );

    if (!options.sessionService) {
        throw new Error(
            "SessionService is required for portfolio routes",
        );
    }

    const requireAuthentication = authenticationGuard(
        options.sessionService,
    );
    app.post("/api/portfolios", async (request, reply) => {
        const result = CreatePortfolioSchema.safeParse(request.body);

        if (!result.success) {
            return reply.code(400).send({
                error: "Invalid portfolio data",
                details: result.error,
            });
        }

        const portfolio = portfolioService.createPortfolio(
            result.data.userId,
            result.data.name
        );

        if (!portfolio) {
            return reply.code(404).send({
                error: "User not found",
            });
        }

        return reply
            .code(201)
            .send(portfolio);
    });

    app.get("/api/portfolios/:id",
        { preHandler: requireAuthentication },
        async (request, reply) => {
            const { id } = request.params as { id: string };

            const portfolio = portfolioService.getPortfolio(Number(id));

            if (
                !portfolio ||
                portfolio.user_id !== request.authenticatedUserId
            ) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            return portfolio;
        });

    app.get(
        "/api/portfolios/:id/holdings",
        async (request, reply) => {
            const { id } = request.params as { id: string };

            const portfolio = portfolioService.getPortfolio(Number(id));

            if (!portfolio) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            return portfolioService.getHoldings(Number(id));
        }
    );

    app.get(
        "/api/portfolios/:id/holdings/as-of",
        async (request, reply) => {
            const { id } = request.params as { id: string };

            const result =
                PortfolioValuationQuerySchema.safeParse(
                    request.query
                );

            if (!result.success) {
                return reply.code(400).send({
                    error: "Invalid date",
                    details: result.error,
                });
            }

            const { date } = result.data;

            const portfolio = portfolioService.getPortfolio(
                Number(id)
            );

            if (!portfolio) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            return portfolioService.getHoldingsAsOf(
                Number(id),
                date
            );
        }
    );

    app.get(
        "/api/portfolios/:id/valuation",
        { preHandler: requireAuthentication },
        async (request, reply) => {
            const { id } = request.params as { id: string };

            const result =
                PortfolioValuationQuerySchema.safeParse(
                    request.query
                );

            if (!result.success) {
                return reply.code(400).send({
                    error: "Invalid valuation parameters",
                    details: result.error,
                });
            }

            const portfolio = portfolioService.getPortfolio(
                Number(id)
            );

            if (!portfolio) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            try {
                return portfolioService.getPortfolioValuation(
                    Number(id),
                    result.data.date,
                    result.data.exchange
                );
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.startsWith("Historical price not found")
                ) {
                    return reply.code(422).send({
                        error: error.message,
                    });
                }

                return reply.code(404).send({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unable to calculate portfolio valuation",
                });
            }
        }
    );

    app.get(
        "/api/portfolios/:id/performance",
        async (request, reply) => {
            const { id } = request.params as { id: string };

            const result = PortfolioValuationQuerySchema.safeParse(
                request.query
            );

            if (!result.success) {
                return reply.code(400).send({
                    error: "Invalid performance parameters",
                    details: result.error,
                });
            }

            const portfolioId = Number(id);
            const { date, exchange } = result.data;

            const portfolio = portfolioService.getPortfolio(portfolioId);

            if (!portfolio) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            try {
                const transactions = transactionService.findByPortfolioId(
                    portfolioId,
                    undefined,
                    date
                ) as Array<{
                    type: "BUY" | "SELL" | "SPLIT";
                    transaction_date: string;
                    quantity: number | null;
                    price: number | null;
                    split_numerator: number | null;
                    split_denominator: number | null;
                }>;

                const valuation = portfolioService.getPortfolioValuation(
                    portfolioId,
                    date,
                    exchange
                );
                const dividends =
                    investmentEventService.getDividendCashFlows(portfolioId);


                const xirr = performanceService.calculateXirr({
                    transactions: transactions.map((transaction) => ({
                        type: transaction.type,
                        date: transaction.transaction_date,
                        ...(transaction.quantity !== null && {
                            quantity: transaction.quantity,
                        }),
                        ...(transaction.price !== null && {
                            price: transaction.price,
                        }),
                        ...(transaction.split_numerator !== null && {
                            split_numerator: transaction.split_numerator,
                        }),
                        ...(transaction.split_denominator !== null && {
                            split_denominator: transaction.split_denominator,
                        }),
                    })),
                    dividends,
                    valuationDate: date,
                    endingMarketValue: valuation.total_market_value,
                });

                return {
                    portfolio_id: portfolioId,
                    date,
                    exchange,
                    ending_market_value: valuation.total_market_value,
                    xirr,
                };
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.startsWith("Historical price not found")
                ) {
                    return reply.code(422).send({
                        error: error.message,
                    });
                }

                if (
                    error instanceof Error &&
                    error.message.startsWith("Listing not found")
                ) {
                    return reply.code(404).send({
                        error: error.message,
                    });
                }

                return reply.code(422).send({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unable to calculate portfolio performance",
                });
            }
        }
    );

}