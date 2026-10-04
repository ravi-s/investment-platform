import type Database from "better-sqlite3";
import { HoldingRepository } from "../repositories/holding.js";
import { PortfolioRepository } from "../repositories/portfolio.js";
import { SecurityRepository } from "../repositories/security.js";
import { TransactionRepository } from "../repositories/transaction.js";
import { previousDate } from "../utils/date.js";

export class TransactionService {
    private readonly transactionRepository: TransactionRepository;
    private readonly holdingRepository: HoldingRepository;
    private readonly portfolioRepository: PortfolioRepository;
    private readonly securityRepository: SecurityRepository;

    constructor(private readonly db: Database.Database) {
        this.transactionRepository = new TransactionRepository(db);
        this.holdingRepository = new HoldingRepository(db);
        this.portfolioRepository = new PortfolioRepository(db);
        this.securityRepository = new SecurityRepository(db);
    }

    /**
     * Creates a transaction and updates the corresponding holding atomically.
     *
     * BUY transactions increase an existing holding or create one when the
     * investor does not currently own the security.
     *
     * SELL transactions require an existing holding and reject quantities
     * greater than the available balance.
     */
    create(
        portfolioId: number,
        securityId: number,
        type: "BUY" | "SELL",
        quantity: number,
        price: number,
        transactionDate: string
    ) {
        if (quantity <= 0) {
            throw new Error("Quantity must be greater than 0");
        }

        if (price <= 0) {
            throw new Error("Price must be greater than 0");
        }

        const portfolio = this.portfolioRepository.findById(portfolioId);
        if (!portfolio) {
            throw new Error("Portfolio not found");
        }

        const security = this.securityRepository.findById(securityId);
        if (!security) {
            throw new Error("Security not found");
        }

        return this.db.transaction(() => {
            const transaction = this.transactionRepository.create(
                portfolioId,
                securityId,
                type,
                quantity,
                price,
                transactionDate
            );

            const holding =
                this.holdingRepository.findByPortfolioAndSecurity(
                    portfolioId,
                    securityId
                );

            if (type === "BUY") {
                if (holding) {
                    this.holdingRepository.updateQuantity(
                        holding.id,
                        quantity
                    );
                } else {
                    this.holdingRepository.create(
                        portfolioId,
                        securityId,
                        quantity
                    );
                }
            } else {
                if (!holding) {
                    throw new Error("Holding not found");
                }

                if (quantity > holding.quantity) {
                    throw new Error("Insufficient holding");
                }

                this.holdingRepository.updateQuantity(
                    holding.id,
                    -quantity
                );
            }

            return transaction;
        })();
    }

    /**
     * Records a stock split as a historical event.
     *
     * The split does not directly modify the current holding. Historical
     * reconstruction applies the split to the open position at its
     * effective transaction date.
     */
    createSplit(
        portfolioId: number,
        securityId: number,
        numerator: number,
        denominator: number,
        transactionDate: string
    ) {
        if (numerator <= 0 || !Number.isInteger(numerator)) {
            throw new Error(
                "Split numerator must be a positive integer"
            );
        }

        if (denominator <= 0 || !Number.isInteger(denominator)) {
            throw new Error(
                "Split denominator must be a positive integer"
            );
        }

        const portfolio = this.portfolioRepository.findById(portfolioId);
        if (!portfolio) {
            throw new Error("Portfolio not found");
        }

        const security = this.securityRepository.findById(securityId);
        if (!security) {
            throw new Error("Security not found");
        }

        return this.transactionRepository.createSplit(
            portfolioId,
            securityId,
            numerator,
            denominator,
            transactionDate
        );
    }

    findById(id: number) {
        return this.transactionRepository.findById(id);
    }

    findByPortfolioId(
        portfolioId: number,
        from?: string,
        to?: string
    ) {
        if (from !== undefined && to !== undefined && from > to) {
            throw new Error("Invalid date range");
        }

        return this.transactionRepository.findByPortfolioId(
            portfolioId,
            from,
            to
        );
    }

    getHoldingAsOf(
        portfolioId: number,
        securityId: number,
        date: string
    ): number {
        const transactions =
            this.transactionRepository.findByPortfolioId(
                portfolioId,
                undefined,
                date
            );

        let quantity = 0;

        for (const transaction of [...transactions].reverse() as Array<{
            security_id: number;
            type: "BUY" | "SELL";
            quantity: number;
            split_numerator: number;
            split_denominator: number;
        }>) {
            if (transaction.security_id !== securityId) {
                continue;
            }
            if (transaction.type === "BUY") {
                quantity += transaction.quantity;
            } else if (transaction.type === "SELL") {
                quantity -= transaction.quantity;
            }
            else if (transaction.type === "SPLIT") {
                // Adjust the quantity based on the split ratio
                quantity = quantity * (transaction.split_numerator! / transaction.split_denominator!);
            }
        }

        return quantity;
    }

    getHoldingChange(
        portfolioId: number,
        securityId: number,
        from: string,
        to: string
    ): number {
        if (from > to) {
            throw new Error("Invalid date range");
        }

        const beforeStart = this.getHoldingAsOf(
            portfolioId,
            securityId,
            previousDate(from)
        );

        const atEnd = this.getHoldingAsOf(
            portfolioId,
            securityId,
            to
        );

        return atEnd - beforeStart;
    }

    findTransactionsForSecurity(
        portfolioId: number,
        securityId: number,
        from?: string,
        to?: string
    ) {
        const transactions =
            this.transactionRepository.findByPortfolioId(
                portfolioId,
                from,
                to
            );

        return (
            transactions as Array<{ security_id: number }>
        ).filter(
            (transaction) =>
                transaction.security_id === securityId
        );
    }

    findSecuritiesHeldAsOf(
        portfolioId: number,
        date: string
    ) {
        const transactions =
            this.transactionRepository.findByPortfolioId(
                portfolioId,
                undefined,
                date
            ) as Array<{
                security_id: number;
                type: string;
                quantity: number;
            }>;

        const quantities = new Map<number, number>();

        for (const transaction of [...transactions].reverse()) {
            const currentQuantity =
                quantities.get(transaction.security_id) ?? 0;

            if (transaction.type === "BUY") {
                quantities.set(
                    transaction.security_id,
                    currentQuantity + transaction.quantity
                );
            } else {
                quantities.set(
                    transaction.security_id,
                    currentQuantity - transaction.quantity
                );
            }
        }

        return Array.from(quantities.entries())
            .filter(([, quantity]) => quantity > 0)
            .map(([security_id, quantity]) => ({
                security_id,
                quantity,
            }));
    }

    getPortfolioCompositionAsOf(
        portfolioId: number,
        date: string
    ) {
        const transactions =
            this.transactionRepository.findByPortfolioId(
                portfolioId,
                undefined,
                date
            ) as Array<{
                security_id: number;
                type: "BUY" | "SELL" | "SPLIT";
                split_numerator: number | null;
                split_denominator: number | null;
                quantity: number;
                price: number;
            }>;

        const composition = new Map<
            number,
            {
                quantity: number;
                acquisition_amount: number;
            }
        >();

        for (const transaction of [...transactions].reverse()) {
            const current =
                composition.get(transaction.security_id) ?? {
                    quantity: 0,
                    acquisition_amount: 0,
                };

            if (transaction.type === "BUY") {
                current.quantity += transaction.quantity;
                current.acquisition_amount +=
                    transaction.quantity * transaction.price;
            } else if (transaction.type === "SELL") {
                current.quantity -= transaction.quantity;
            } else if (transaction.type === "SPLIT") {
                current.quantity =
                    current.quantity *
                    (transaction.split_numerator! /
                        transaction.split_denominator!);
            }

            composition.set(
                transaction.security_id,
                current
            );
        }

        return Array.from(composition.entries())
            .filter(
                ([, position]) =>
                    position.quantity > 0
            )
            .map(([security_id, position]) => ({
                security_id,
                quantity: position.quantity,
                acquisition_amount:
                    position.acquisition_amount,
            }));
    }
}