import { type FastifyInstance } from "fastify";
import { SecurityService } from "../services/security.js";

const service = new SecurityService();

export async function securityRoutes(app: FastifyInstance) {
    app.get("/api/securities/:id", async (request, reply) => {
        const { id } = request.params as { id: string };

        const security = service.getSecurity(Number(id));

        if (!security) {
            return reply.code(404).send({
                error: "Security not found"
            });
        }

        return security;
    });

    app.get(
        "/api/securities/:exchange/:symbol",
        async (request, reply) => {
            const { exchange, symbol } =
                request.params as {
                    exchange: string;
                    symbol: string;
                };

            const listing =
                service.getListing(exchange, symbol);

            if (!listing) {
                return reply.code(404).send({
                    error: "Security listing not found"
                });
            }

            return listing;
        }
    );
}