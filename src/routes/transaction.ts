import { type FastifyInstance } from "fastify";
import { z } from "zod";
import { TransactionService } from "../services/transaction.js";

const service = new TransactionService();

const CreateTransactionSchema = z.object({
    portfolioId: z.number().int().positive(),
    securityId: z.number().int().positive(),
    type: z.enum(["BUY", "SELL"]),
    quantity: z.number().positive(),
    price: z.number().positive(),
    transactionDate: z.string().min(1),
});

const DateOnlySchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .refine(
        (value) => {
            const parts: number[] = value.split("-").map(Number);
            const [year, month, day] = parts as [number, number, number];
            const date = new Date(Date.UTC(year, month - 1, day));

            return (
                date.getUTCFullYear() === year &&
                date.getUTCMonth() === month - 1 &&
                date.getUTCDate() === day
            );
        },
        "Invalid calendar date"
    );

const TransactionQuerySchema = z.object({
    from: DateOnlySchema.optional(),
    to: DateOnlySchema.optional(),
});
export async function transactionRoutes(app: FastifyInstance) {
    app.post("/api/transactions", async (request, reply) => {
        const result = CreateTransactionSchema.safeParse(request.body);

        if (!result.success) {
            return reply.code(400).send({
                error: "Invalid transaction data",
                details: result.error,
            });
        }

        try {
            const transaction = service.create(
                result.data.portfolioId,
                result.data.securityId,
                result.data.type,
                result.data.quantity,
                result.data.price,
                result.data.transactionDate
            );

            return reply.code(201).send(transaction);
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
            if (
                error instanceof Error &&
                error.message === "Holding not found"
            ) {
                return reply.code(409).send({
                    error: "Holding not found",
                });
            }

            if (
                error instanceof Error &&
                error.message === "Insufficient holding"
            ) {
                return reply.code(409).send({
                    error: "Insufficient holding",
                });
            }

            throw error;
        }
    });

    app.get("/api/transactions/:id", async (request, reply) => {
        const { id } = request.params as { id: string };

        const transaction = service.findById(Number(id));

        if (!transaction) {
            return reply.code(404).send({
                error: "Transaction not found",
            });
        }

        return transaction;
    });

    app.get(
        "/api/portfolios/:portfolioId/transactions",
        async (request, reply) => {
            const { portfolioId } = request.params as {
                portfolioId: string;
            };

            const result = TransactionQuerySchema.safeParse(request.query);

            if (!result.success) {
                return reply.code(400).send({
                    error: "Invalid query parameters",
                    details: result.error,
                });
            }

            try {
                return service.findByPortfolioId(
                    Number(portfolioId),
                    result.data.from,
                    result.data.to
                );
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message === "Invalid date range"
                ) {
                    return reply.code(400).send({
                        error: "Invalid date range",
                    });
                }

                throw error;
            }
        }
    );
}