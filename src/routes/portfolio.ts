import { type FastifyInstance } from "fastify";
import { z } from "zod";
import { PortfolioService } from "../services/portfolio.js";
import db from "../db/database.ts";
import { DateOnlySchema } from "../schema/date.ts";

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
    service?: PortfolioService;
};

export async function portfolioRoutes(
    app: FastifyInstance,
    options: PortfolioRouteOptions = {}
) {
    const portfolioService =
        options.service ?? new PortfolioService(db);

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

    app.get("/api/portfolios/:id", async (request, reply) => {
        const { id } = request.params as { id: string };

        const portfolio = portfolioService.getPortfolio(Number(id));

        if (!portfolio) {
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
                return reply.code(404).send({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unable to calculate portfolio valuation",
                });
            }
        }
    );
}