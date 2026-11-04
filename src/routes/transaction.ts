import { type FastifyInstance } from "fastify";
import { z } from "zod";
import type { TransactionService } from "../services/transaction.js";
import type { SessionService } from "../services/session.js";
import {
    CsvImportValidationError,
    type TransactionImportService,
} from "../services/transaction-import-service.js";
import { authenticationGuard } from "./authentication-guard.js";

const CreateTransactionSchema = z.discriminatedUnion("type", [
    z.object({
        portfolioId: z.number().int().positive(),
        securityId: z.number().int().positive(),
        type: z.literal("BUY"),
        quantity: z.number().positive(),
        price: z.number().positive(),
        transactionDate: DateOnlySchema,
    }),

    z.object({
        portfolioId: z.number().int().positive(),
        securityId: z.number().int().positive(),
        type: z.literal("SELL"),
        quantity: z.number().positive(),
        price: z.number().positive(),
        transactionDate: DateOnlySchema,
    }),

    z.object({
        portfolioId: z.number().int().positive(),
        securityId: z.number().int().positive(),
        type: z.literal("SPLIT"),
        splitNumerator: z.number().int().positive(),
        splitDenominator: z.number().int().positive(),
        transactionDate: DateOnlySchema,
    }),
]);

import { DateOnlySchema } from "../schema/date.js";

const TransactionQuerySchema = z.object({
    from: DateOnlySchema.optional(),
    to: DateOnlySchema.optional(),
});

const HoldingAsOfQuerySchema = z.object({
    asOf: DateOnlySchema,
});

const AsOfQuerySchema = z.object({
    asOf: DateOnlySchema,
});

export async function transactionRoutes(
    app: FastifyInstance,
    options: {
        service: TransactionService;
        sessionService: SessionService;
        importService: TransactionImportService;
    }
) {
    const { service, sessionService, importService } = options;
    const requireAuthentication = authenticationGuard(sessionService);
    app.addHook("preHandler", requireAuthentication);

    // Create a buy, sell, or split transaction after validating its portfolio ownership.
    app.post("/api/transactions", async (request, reply) => {
        const result = CreateTransactionSchema.safeParse(request.body);

        if (!result.success) {
            return reply.code(400).send({
                error: "Invalid transaction data",
                details: result.error,
            });
        }

        const portfolio = service.findPortfolioById(
            result.data.portfolioId
        );

        if (
            !portfolio ||
            portfolio.user_id !== request.authenticatedUserId
        ) {
            return reply.code(404).send({
                error: "Portfolio not found",
            });
        }



        try {
            let transaction;

            if (result.data.type === "SPLIT") {
                transaction = service.createSplit(
                    result.data.portfolioId,
                    result.data.securityId,
                    result.data.splitNumerator,
                    result.data.splitDenominator,
                    result.data.transactionDate
                );
            } else {
                transaction = service.create(
                    result.data.portfolioId,
                    result.data.securityId,
                    result.data.type,
                    result.data.quantity,
                    result.data.price,
                    result.data.transactionDate
                );
            }

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

    // Return a transaction only when it belongs to the authenticated user.
    app.get("/api/transactions/:id", async (request, reply) => {
        const { id } = request.params as { id: string };

        const transaction = service.findByIdWithOwner(Number(id));

        if (
            !transaction ||
            transaction.user_id !== request.authenticatedUserId
        ) {
            return reply.code(404).send({
                error: "Transaction not found",
            });
        }

        const { user_id: _userId, ...result } = transaction;
        return result;
    });

    // List a portfolio's transactions, optionally filtered by a date range.
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

    // Report the quantity of a security held in a portfolio on a given date.
    app.get(
        "/api/portfolios/:portfolioId/securities/:securityId/holding",
        async (request, reply) => {
            const { portfolioId, securityId } = request.params as {
                portfolioId: string;
                securityId: string;
            };

            const result = HoldingAsOfQuerySchema.safeParse(request.query);

            if (!result.success) {
                return reply.code(400).send({
                    error: "Invalid query parameters",
                    details: result.error,
                });
            }

            const portfolio = service.findPortfolioById(
                Number(portfolioId)
            );

            if (
                !portfolio ||
                portfolio.user_id !== request.authenticatedUserId
            ) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }
            const quantity = service.getHoldingAsOf(
                Number(portfolioId),
                Number(securityId),
                result.data.asOf
            );

            return {
                portfolio_id: Number(portfolioId),
                security_id: Number(securityId),
                as_of: result.data.asOf,
                quantity,
            };
        }
    );

    // Report the change in a security's holding between two dates.
    app.get(
        "/api/portfolios/:portfolioId/securities/:securityId/holding/change",
        async (request, reply) => {
            const { portfolioId, securityId } = request.params as {
                portfolioId: string;
                securityId: string;
            };

            const result = TransactionQuerySchema.safeParse(request.query);

            if (!result.success) {
                return reply.code(400).send({
                    error: "Invalid query parameters",
                    details: result.error,
                });
            }

            if (!result.data.from || !result.data.to) {
                return reply.code(400).send({
                    error: "Both 'from' and 'to' query parameters are required",
                });
            }

            const portfolio = service.findPortfolioById(
                Number(portfolioId)
            );

            if (
                !portfolio ||
                portfolio.user_id !== request.authenticatedUserId
            ) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            try {
                const quantityChange = service.getHoldingChange(
                    Number(portfolioId),
                    Number(securityId),
                    result.data.from,
                    result.data.to
                );

                return {
                    portfolio_id: Number(portfolioId),
                    security_id: Number(securityId),
                    from: result.data.from,
                    to: result.data.to,
                    quantity_change: quantityChange,
                };
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

    // List transactions for one security in a portfolio, optionally by date range.
    app.get(
        "/api/portfolios/:portfolioId/securities/:securityId/transactions",
        async (request, reply) => {
            const { portfolioId, securityId } = request.params as {
                portfolioId: string;
                securityId: string;
            };

            const result = TransactionQuerySchema.safeParse(request.query);

            if (!result.success) {
                return reply.code(400).send({
                    error: "Invalid query parameters",
                    details: result.error,
                });
            }
            const portfolio = service.findPortfolioById(
                Number(portfolioId)
            );

            if (
                !portfolio ||
                portfolio.user_id !== request.authenticatedUserId
            ) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            try {
                return service.findTransactionsForSecurity(
                    Number(portfolioId),
                    Number(securityId),
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

    // List the securities held in a portfolio as of the requested date.
    app.get(
        "/api/portfolios/:portfolioId/securities",
        async (request, reply) => {
            const { portfolioId } = request.params as {
                portfolioId: string;
            };

            const result = AsOfQuerySchema.safeParse(request.query);

            if (!result.success) {
                return reply.code(400).send({
                    error: "Invalid query parameters",
                    details: result.error,
                });
            }
            const portfolio = service.findPortfolioById(
                Number(portfolioId)
            );

            if (
                !portfolio ||
                portfolio.user_id !== request.authenticatedUserId
            ) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            return service.findSecuritiesHeldAsOf(
                Number(portfolioId),
                result.data.asOf
            );
        }
    );

    // Import portfolio transactions from CSV and report validation or conflict errors.
    app.post<{
        Params: { portfolioId: string };
        Body: { csv: string };
    }>(
        "/api/portfolios/:portfolioId/transactions/import",
        async (request, reply) => {
            const portfolioId = Number(request.params.portfolioId);

            if (!Number.isSafeInteger(portfolioId) || portfolioId <= 0) {
                return reply.code(400).send({ error: "Invalid portfolio ID" });
            }

            const bodySchema = z.object({
                csv: z.string().min(1),
            }).strict();

            const parsedBody = bodySchema.safeParse(request.body);

            if (!parsedBody.success) {
                return reply.code(400).send({ error: "Invalid request body" });
            }

            const portfolio = service.findPortfolioById(portfolioId);

            if (
                !portfolio ||
                portfolio.user_id !== request.authenticatedUserId
            ) {
                return reply.code(404).send({ error: "Portfolio not found" });
            }

            try {
                const imported = importService.importCsv(
                    request.authenticatedUserId,
                    portfolioId,
                    parsedBody.data.csv
                );

                return reply.code(201).send({
                    importedCount: imported.length,
                });
            } catch (error) {
                if (error instanceof CsvImportValidationError) {
                    return reply.code(400).send({ error: error.message });
                }

                const message =
                    error instanceof Error ? error.message : "Import failed";

                if (
                    message.includes("Insufficient holding") ||
                    message.includes("Holding not found") ||
                    message.includes("CSV file has already been imported")
                ) {
                    return reply.code(409).send({ error: message });
                }

                request.log.error({ err: error }, "CSV transaction import failed");

                return reply.code(500).send({
                    error: "Internal server error",
                });
            }
        }
    );

    app.post<{
        Params: { portfolioId: string };
        Body: { csv: string };
    }>(
        "/api/portfolios/:portfolioId/transactions/import/stage",
        async (request, reply) => {
            const portfolioId = Number(request.params.portfolioId);

            if (!Number.isSafeInteger(portfolioId) || portfolioId <= 0) {
                return reply.code(400).send({ error: "Invalid portfolio ID" });
            }

            const bodySchema = z.object({
                csv: z.string().min(1),
            }).strict();
            const parsedBody = bodySchema.safeParse(request.body);

            if (!parsedBody.success) {
                return reply.code(400).send({ error: "Invalid request body" });
            }

            const userId = request.authenticatedUserId;

            if (userId === null) {
                return reply.code(401).send({
                    error: "Authentication required",
                });
            }

            const portfolio = service.findPortfolioById(portfolioId);

            if (!portfolio || portfolio.user_id !== userId) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            const result = importService.stageCsv(
                userId,
                portfolioId,
                parsedBody.data.csv
            );

            return reply.status(201).send({
                batchId: result.batch.id,
                status: result.batch.status,
                stagedCount: result.items.length,
            });
        }
    );

    app.get<{
        Params: {
            portfolioId: string;
            batchId: string;
        };
    }>(
        "/api/portfolios/:portfolioId/transactions/import/batches/:batchId",
        async (request, reply) => {
            const portfolioId = Number(request.params.portfolioId);
            const batchId = Number(request.params.batchId);

            if (
                !Number.isSafeInteger(portfolioId) ||
                portfolioId <= 0 ||
                !Number.isSafeInteger(batchId) ||
                batchId <= 0
            ) {
                return reply.code(400).send({
                    error: "Invalid portfolio or batch ID",
                });
            }

            const userId = request.authenticatedUserId;

            if (userId === null) {
                return reply.code(401).send({
                    error: "Authentication required",
                });
            }

            const portfolio = service.findPortfolioById(portfolioId);

            if (!portfolio || portfolio.user_id !== userId) {
                return reply.code(404).send({
                    error: "Portfolio not found",
                });
            }

            const batch = importService.findBatchById(batchId);

            if (
                !batch ||
                batch.user_id !== userId ||
                batch.portfolio_id !== portfolioId
            ) {
                return reply.code(404).send({
                    error: "Import batch not found",
                });
            }

            const items = importService.findBatchItems(batchId);

            return reply.code(200).send({
                batch,
                items,
            });
        }
    );
}