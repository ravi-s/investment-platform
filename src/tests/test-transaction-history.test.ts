import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runMigrations } from "../db/migration-runner.ts";
import { TransactionService } from "../services/transaction.ts";

describe("TransactionService history", () => {
    let db: Database.Database;
    let transactionService: TransactionService;
    let portfolioId: number;
    let relianceId: number;
    let tcsId: number;

    beforeAll(() => {
        db = new Database(":memory:");
        db.pragma("foreign_keys = ON");
        runMigrations(db);

        db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Test User", "transaction-history@example.com");

        portfolioId = Number(
            db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Test Portfolio").lastInsertRowid
        );

        relianceId = Number(
            db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Reliance Industries Limited").lastInsertRowid
        );

        tcsId = Number(
            db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Tata Consultancy Services Limited").lastInsertRowid
        );

        transactionService = new TransactionService(db);

        transactionService.create(
            portfolioId,
            relianceId,
            "BUY",
            10,
            100,
            "2026-09-21"
        );
        transactionService.create(
            portfolioId,
            relianceId,
            "BUY",
            5,
            110,
            "2026-09-22"
        );
        transactionService.create(
            portfolioId,
            relianceId,
            "SELL",
            3,
            120,
            "2026-09-23"
        );
        transactionService.create(
            portfolioId,
            tcsId,
            "BUY",
            4,
            200,
            "2026-09-22"
        );
        transactionService.create(
            portfolioId,
            tcsId,
            "SELL",
            1,
            210,
            "2026-09-23"
        );
    });

    afterAll(() => {
        db.close();
    });

    it("reconstructs the holding as of each requested date", () => {
        expect(
            transactionService.getHoldingAsOf(
                portfolioId,
                relianceId,
                "2026-09-21"
            )
        ).toBe(10);
        expect(
            transactionService.getHoldingAsOf(
                portfolioId,
                relianceId,
                "2026-09-22"
            )
        ).toBe(15);
        expect(
            transactionService.getHoldingAsOf(
                portfolioId,
                relianceId,
                "2026-09-23"
            )
        ).toBe(12);
    });

    it("calculates the net holding change across an inclusive date range", () => {
        expect(
            transactionService.getHoldingChange(
                portfolioId,
                relianceId,
                "2026-09-22",
                "2026-09-23"
            )
        ).toBe(2);
    });

    it("filters a security's transactions by date", () => {
        expect(
            transactionService.findTransactionsForSecurity(
                portfolioId,
                relianceId,
                "2026-09-23",
                "2026-09-23"
            )
        ).toMatchObject([
            {
                portfolio_id: portfolioId,
                security_id: relianceId,
                type: "SELL",
                quantity: 3,
                price: 120,
                transaction_date: "2026-09-23",
            },
        ]);

        expect(
            transactionService.findTransactionsForSecurity(
                portfolioId,
                tcsId,
                "2026-09-22",
                "2026-09-23"
            )
        ).toMatchObject([
            {
                portfolio_id: portfolioId,
                security_id: tcsId,
                type: "SELL",
                quantity: 1,
                price: 210,
                transaction_date: "2026-09-23",
            },
            {
                portfolio_id: portfolioId,
                security_id: tcsId,
                type: "BUY",
                quantity: 4,
                price: 200,
                transaction_date: "2026-09-22",
            },
        ]);
    });

    it("returns only securities with positive holdings as of each date", () => {
        expect(
            transactionService.findSecuritiesHeldAsOf(
                portfolioId,
                "2026-09-21"
            )
        ).toEqual([{ security_id: relianceId, quantity: 10 }]);

        expect(
            transactionService.findSecuritiesHeldAsOf(
                portfolioId,
                "2026-09-22"
            )
        ).toEqual([
            { security_id: relianceId, quantity: 15 },
            { security_id: tcsId, quantity: 4 },
        ]);

        expect(
            transactionService.findSecuritiesHeldAsOf(
                portfolioId,
                "2026-09-23"
            )
        ).toEqual([
            { security_id: relianceId, quantity: 12 },
            { security_id: tcsId, quantity: 3 },
        ]);
    });

    it("returns portfolio composition as of the requested date", () => {
        expect(
            transactionService.getPortfolioCompositionAsOf(
                portfolioId,
                "2026-09-23"
            )
        ).toEqual([
            {
                security_id: relianceId,
                quantity: 12,
                acquisition_amount: 1550,
            },
            {
                security_id: tcsId,
                quantity: 3,
                acquisition_amount: 800,
            },
        ]);
    });
});

describe("TransactionService stock-split history", () => {
    it("adjusts historical quantity for a 1:2 split on its effective date", () => {
        const db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        try {
            runMigrations(db);

            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Split History User", "split-history@example.com");

            const portfolioId = Number(
                db.prepare(`
                    INSERT INTO portfolios (user_id, name)
                    VALUES (?, ?)
                `).run(1, "Split History Portfolio").lastInsertRowid
            );

            const securityId = Number(
                db.prepare(`
                    INSERT INTO securities (name)
                    VALUES (?)
                `).run("Split History Security").lastInsertRowid
            );

            const transactionService = new TransactionService(db);
            transactionService.create(
                portfolioId,
                securityId,
                "BUY",
                10,
                100,
                "2026-09-22"
            );
            transactionService.createSplit(
                portfolioId,
                securityId,
                2,
                1,
                "2026-09-23"
            );


            expect(
                transactionService.getHoldingAsOf(
                    portfolioId,
                    securityId,
                    "2026-09-22"
                )
            ).toBe(10);

            expect(
                transactionService.getHoldingAsOf(
                    portfolioId,
                    securityId,
                    "2026-09-23"
                )
            ).toBe(20);
        } finally {
            db.close();
        }
    });

    it("adjusts all accumulated lots for a 1:2 split", () => {
        const db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        try {
            runMigrations(db);

            db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Multiple Lot Split User", "multiple-lot-split@example.com");

            const portfolioId = Number(
                db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Multiple Lot Split Portfolio").lastInsertRowid
            );

            const securityId = Number(
                db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Multiple Lot Split Security").lastInsertRowid
            );

            const transactionService = new TransactionService(db);

            transactionService.create(
                portfolioId,
                securityId,
                "BUY",
                10,
                100,
                "2026-09-21"
            );

            transactionService.create(
                portfolioId,
                securityId,
                "BUY",
                5,
                110,
                "2026-09-22"
            );

            transactionService.createSplit(
                portfolioId,
                securityId,
                2,
                1,
                "2026-09-23"
            );

            expect(
                transactionService.getHoldingAsOf(
                    portfolioId,
                    securityId,
                    "2026-09-22"
                )
            ).toBe(15);

            expect(
                transactionService.getHoldingAsOf(
                    portfolioId,
                    securityId,
                    "2026-09-23"
                )
            ).toBe(30);
        } finally {
            db.close();
        }
    });

    it("does not adjust a buy that occurs after the split", () => {
        const db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        try {
            runMigrations(db);

            db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Post Split Buy User", "post-split-buy@example.com");

            const portfolioId = Number(
                db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Post Split Buy Portfolio").lastInsertRowid
            );

            const securityId = Number(
                db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Post Split Buy Security").lastInsertRowid
            );

            const transactionService = new TransactionService(db);

            transactionService.create(
                portfolioId,
                securityId,
                "BUY",
                10,
                100,
                "2026-09-21"
            );

            transactionService.createSplit(
                portfolioId,
                securityId,
                2,
                1,
                "2026-09-23"
            );

            transactionService.create(
                portfolioId,
                securityId,
                "BUY",
                5,
                60,
                "2026-09-24"
            );

            expect(
                transactionService.getHoldingAsOf(
                    portfolioId,
                    securityId,
                    "2026-09-23"
                )
            ).toBe(20);

            expect(
                transactionService.getHoldingAsOf(
                    portfolioId,
                    securityId,
                    "2026-09-24"
                )
            ).toBe(25);
        } finally {
            db.close();
        }
    });

    it("adjusts the remaining holding after a sell before the split", () => {
        const db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        try {
            runMigrations(db);

            db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Sell Before Split User", "sell-before-split@example.com");

            const portfolioId = Number(
                db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Sell Before Split Portfolio").lastInsertRowid
            );

            const securityId = Number(
                db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Sell Before Split Security").lastInsertRowid
            );

            const transactionService = new TransactionService(db);

            transactionService.create(
                portfolioId,
                securityId,
                "BUY",
                10,
                100,
                "2026-09-21"
            );

            transactionService.create(
                portfolioId,
                securityId,
                "SELL",
                4,
                120,
                "2026-09-22"
            );

            transactionService.createSplit(
                portfolioId,
                securityId,
                2,
                1,
                "2026-09-23"
            );

            expect(
                transactionService.getHoldingAsOf(
                    portfolioId,
                    securityId,
                    "2026-09-22"
                )
            ).toBe(6);

            expect(
                transactionService.getHoldingAsOf(
                    portfolioId,
                    securityId,
                    "2026-09-23"
                )
            ).toBe(12);
        } finally {
            db.close();
        }
    });

    it("preserves acquisition amount through a stock split", () => {
        const db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        try {
            runMigrations(db);

            db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run(
                "Split Acquisition User",
                "split-acquisition@example.com"
            );

            const portfolioId = Number(
                db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Split Acquisition Portfolio").lastInsertRowid
            );

            const securityId = Number(
                db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Split Acquisition Security").lastInsertRowid
            );

            const transactionService = new TransactionService(db);

            transactionService.create(
                portfolioId,
                securityId,
                "BUY",
                10,
                100,
                "2026-09-22"
            );

            transactionService.createSplit(
                portfolioId,
                securityId,
                2,
                1,
                "2026-09-23"
            );

            expect(
                transactionService.getPortfolioCompositionAsOf(
                    portfolioId,
                    "2026-09-22"
                )
            ).toEqual([
                {
                    security_id: securityId,
                    quantity: 10,
                    acquisition_amount: 1000,
                },
            ]);

            expect(
                transactionService.getPortfolioCompositionAsOf(
                    portfolioId,
                    "2026-09-23"
                )
            ).toEqual([
                {
                    security_id: securityId,
                    quantity: 20,
                    acquisition_amount: 1000,
                },
            ]);
        } finally {
            db.close();
        }
    });
    it("adjusts securities held after a stock split", () => {
        const db = new Database(":memory:");
        db.pragma("foreign_keys = ON");
        try {
            runMigrations(db);

            db.prepare(`
                INSERT INTO users (name, email)
                VALUES (?, ?)
            `).run("Split Held User", "split-held@example.com");

            const portfolioId = Number(
                db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Split Held Portfolio").lastInsertRowid
            );

            const securityId = Number(
                db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Split Held Security").lastInsertRowid
            );

            const transactionService = new TransactionService(db);
            transactionService.create(
                portfolioId,
                securityId,
                "BUY",
                10,
                100,
                "2026-09-20",
            );

            transactionService.createSplit(
                portfolioId,
                securityId,
                2,
                1,
                "2026-09-23",
            );

            const result = transactionService.findSecuritiesHeldAsOf(
                portfolioId,
                "2026-09-23",
            );

            expect(result).toEqual([
                {
                    security_id: securityId,
                    quantity: 20,
                },
            ]);
        } finally {
            db.close();
        }
    });
    it("persists and retrieves a stock split transaction", () => {
        const db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        try {
            runMigrations(db);

            db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Persistence User", "persistence@example.com");

            const portfolioId = Number(
                db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Persistence Portfolio").lastInsertRowid
            );

            const securityId = Number(
                db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Persistence Security").lastInsertRowid
            );

            const transactionService = new TransactionService(db);

            const split = transactionService.createSplit(
                portfolioId,
                securityId,
                2,
                1,
                "2026-09-30"
            ) as {
                id: number;
                portfolio_id: number;
                security_id: number;
                type: string;
                split_numerator: number;
                split_denominator: number;
                transaction_date: string;
                quantity: number | null;
                price: number | null;
            };

            expect(split).toMatchObject({
                portfolio_id: portfolioId,
                security_id: securityId,
                type: "SPLIT",
                split_numerator: 2,
                split_denominator: 1,
                transaction_date: "2026-09-30",
            });

            expect(split.quantity).toBeNull();
            expect(split.price).toBeNull();

            const retrieved = transactionService.findById(split.id) as typeof split;

            expect(retrieved).toMatchObject({
                id: split.id,
                portfolio_id: portfolioId,
                security_id: securityId,
                type: "SPLIT",
                split_numerator: 2,
                split_denominator: 1,
                transaction_date: "2026-09-30",
            });

            expect(retrieved.quantity).toBeNull();
            expect(retrieved.price).toBeNull();


        } finally {
            db.close();
        }
    });

    it("returns stock split transactions through portfolio queries", () => {
        const db = new Database(":memory:");
        db.pragma("foreign_keys = ON");

        try {
            runMigrations(db);

            db.prepare(`
            INSERT INTO users (name, email)
            VALUES (?, ?)
        `).run("Query User", "query@example.com");

            const portfolioId = Number(
                db.prepare(`
                INSERT INTO portfolios (user_id, name)
                VALUES (?, ?)
            `).run(1, "Query Portfolio").lastInsertRowid
            );

            const securityId = Number(
                db.prepare(`
                INSERT INTO securities (name)
                VALUES (?)
            `).run("Query Security").lastInsertRowid
            );

            const transactionService = new TransactionService(db);

            transactionService.create(
                portfolioId,
                securityId,
                "BUY",
                10,
                100,
                "2026-09-29"
            );

            transactionService.createSplit(
                portfolioId,
                securityId,
                2,
                1,
                "2026-09-30"
            );

            const transactions = transactionService.findByPortfolioId(
                portfolioId,
                "2026-09-29",
                "2026-09-30"
            ) as Array<{
                type: string;
                quantity: number | null;
                price: number | null;
                split_numerator: number | null;
                split_denominator: number | null;
                transaction_date: string;
            }>;

            expect(transactions).toHaveLength(2);

            // Newest transaction first.
            expect(transactions[0]).toMatchObject({
                type: "SPLIT",
                quantity: null,
                price: null,
                split_numerator: 2,
                split_denominator: 1,
                transaction_date: "2026-09-30",
            });

            expect(transactions[1]).toMatchObject({
                type: "BUY",
                quantity: 10,
                price: 100,
                split_numerator: null,
                split_denominator: null,
                transaction_date: "2026-09-29",
            });
        } finally {
            db.close();
        }
    });
});
