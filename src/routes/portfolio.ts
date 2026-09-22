import { type FastifyInstance } from "fastify";
import { z } from "zod";
import { PortfolioService } from "../services/portfolio.js";

const service = new PortfolioService();

const CreatePortfolioSchema = z.object({
    userId: z.number().int().positive(),
    name: z.string().min(1),
});

export async function portfolioRoutes(app: FastifyInstance) {
    app.post("/api/portfolios", async (request, reply) => {
        const result = CreatePortfolioSchema.safeParse(request.body);

        if (!result.success) {
            return reply.code(400).send({
                error: "Invalid portfolio data",
                details: result.error,
            });
        }

        const portfolio = service.createPortfolio(
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

        const portfolio = service.getPortfolio(Number(id));

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

            const portfolio = service.getPortfolio(Number(id));

            if (!portfolio) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            return service.getHoldings(Number(id));
        }
    );
}