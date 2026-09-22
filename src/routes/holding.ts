import { type FastifyInstance } from "fastify";
import { z } from "zod";
import { HoldingService } from "../services/holding.js";

const service = new HoldingService();

const CreateHoldingSchema = z.object({
    securityId: z.number().int().positive(),
    quantity: z.number().positive(),
});

export async function holdingRoutes(app: FastifyInstance) {

    app.post(
        "/api/portfolios/:portfolioId/holdings",
        async (request, reply) => {
            const { portfolioId } = request.params as {
                portfolioId: string;
            };

            const result = CreateHoldingSchema.safeParse(request.body);

            if (!result.success) {
                return reply.code(400).send({
                    error: "Invalid holding data",
                    details: result.error,
                });
            }

            try {
                const holding = service.create(
                    Number(portfolioId),
                    result.data.securityId,
                    result.data.quantity
                );

                return reply
                    .code(201)
                    .send(holding);
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message === "Portfolio not found"
                ) {
                    return reply.code(404).send({
                        error: "Portfolio not found",
                    });
                }

                if (
                    error instanceof Error &&
                    error.message === "Security not found"
                ) {
                    return reply.code(404).send({
                        error: "Security not found",
                    });
                }

                throw error;
            }
        }
    );

    app.get(
        "/api/holdings/:id",
        async (request, reply) => {
            const { id } = request.params as { id: string };

            const holding = service.findById(Number(id));

            if (!holding) {
                return reply.code(404).send({
                    error: "Holding not found",
                });
            }

            return holding;
        }
    );
}