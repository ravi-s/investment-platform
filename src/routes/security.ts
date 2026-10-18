import { type FastifyInstance } from "fastify";
import { SecurityService } from "../services/security.js";

interface SecurityRouteOptions {
    service?: SecurityService;
}

export async function securityRoutes(
    app: FastifyInstance,
    options: SecurityRouteOptions = {},
) {
    const service = options.service ?? new SecurityService();

    app.get("/api/securities/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const securityId = Number(id);

        if (
            !Number.isSafeInteger(securityId) ||
            securityId <= 0
        ) {
            return reply.code(400).send({
                error: "Invalid security ID",
            });
        }

        const security = service.getSecurity(securityId);

        if (!security) {
            return reply.code(404).send({
                error: "Security not found",
            });
        }

        return security;
    });

    app.get(
        "/api/securities/:exchange/:symbol",
        async (request, reply) => {
            const { exchange, symbol } = request.params as {
                exchange: string;
                symbol: string;
            };

            const listing = service.getListing(exchange, symbol);

            if (!listing) {
                return reply.code(404).send({
                    error: "Security listing not found",
                });
            }

            return listing;
        },
    );
}
