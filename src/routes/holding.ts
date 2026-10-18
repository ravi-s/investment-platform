import { type FastifyInstance } from "fastify";
import { z } from "zod";

import type { HoldingService } from "../services/holding.js";
import type { SessionService } from "../services/session.js";
import { authenticationGuard } from "./authentication-guard.js";



const CreateHoldingSchema = z.object({
    securityId: z.number().int().positive(),
    quantity: z.number().positive(),
});

// Register holding endpoints and protect them with the session authentication guard.
export async function holdingRoutes(
    app: FastifyInstance,
    options: {
        service: HoldingService;
        sessionService: SessionService;
    }
) {
    const { service, sessionService } = options;

    const requireAuthentication = authenticationGuard(sessionService);
    app.addHook("preHandler", requireAuthentication);

    // Create a holding for the portfolio specified in the route parameters.
    app.post(
        "/api/portfolios/:portfolioId/holdings",
        async (request, reply) => {
            const { portfolioId } = request.params as {
                portfolioId: string;
            };

            // Reject malformed input before invoking the service layer.
            const result = CreateHoldingSchema.safeParse(request.body);

            if (!result.success) {
                return reply.code(400).send({
                    error: "Invalid holding data",
                    details: result.error,
                });
            }
            const portfolio = service.findPortfolioById(Number(portfolioId));

            if (
                !portfolio ||
                portfolio.user_id !== request.authenticatedUserId
            ) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            try {
                // The service creates the holding and verifies referenced records.
                const holding = service.create(
                    Number(portfolioId),
                    result.data.securityId,
                    result.data.quantity
                );

                return reply
                    .code(201)
                    .send(holding);
            } catch (error) {
                // Convert expected missing-resource errors into HTTP 404 responses.
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

    // Look up a holding by ID and report when no matching record exists.
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

            const portfolio = service.findPortfolioById(holding.portfolio_id);

            if (
                !portfolio ||
                portfolio.user_id !== request.authenticatedUserId
            ) {
                return reply.code(404).send({
                    error: "Holding not found",
                });
            }

            return holding;
        }
    );
}