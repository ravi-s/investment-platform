import type Database from "better-sqlite3";

/** Provides persistence operations for investment events. */
export class InvestmentEventRepository {
    /** Creates a repository backed by the given SQLite database. */
    constructor(private readonly db: Database.Database) { }

    /** Returns the investment event with the given ID, or `undefined` if none exists. */
    findById(id: number): {
        id: number;
        security_id: number;
        event_type: "DIVIDEND";
        ex_date: string;
        record_date: string;
        payment_date: string;
        amount_per_unit: number;
        currency: string;
    } | undefined {
        return this.db
            .prepare(`
            SELECT
                id,
                security_id,
                event_type,
                ex_date,
                record_date,
                payment_date,
                amount_per_unit,
                currency
            FROM investment_events
            WHERE id = ?
        `)
            .get(id) as {
                id: number;
                security_id: number;
                event_type: "DIVIDEND";
                ex_date: string;
                record_date: string;
                payment_date: string;
                amount_per_unit: number;
                currency: string;
            } | undefined;
    }

    /**
     * Returns dividend events for securities associated with the given portfolio.
     * @param portfolioId - The ID of the portfolio.
     */
    findDividendEventsByPortfolioId(portfolioId: number): Array<{
        id: number;
        security_id: number;
        event_type: "DIVIDEND";
        ex_date: string;
        record_date: string;
        payment_date: string;
        amount_per_unit: number;
        currency: string;
    }> {
        return this.db
            .prepare(`
                SELECT
                    id,
                    security_id,
                    event_type,
                    ex_date,
                    record_date,
                    payment_date,
                    amount_per_unit,
                    currency
                FROM investment_events
                WHERE event_type = 'DIVIDEND'
                    AND EXISTS (
                        SELECT 1
                        FROM transactions
                        WHERE transactions.portfolio_id = ?
                            AND transactions.security_id = investment_events.security_id
                    )
                ORDER BY ex_date, id
            `)
            .all(portfolioId) as Array<{
                id: number;
                security_id: number;
                event_type: "DIVIDEND";
                ex_date: string;
                record_date: string;
                payment_date: string;
                amount_per_unit: number;
                currency: string;
            }>;
    }

    /**
     * Inserts a dividend event and returns the persisted event.
     * @param securityId - The ID of the security associated with the event.
     * @param eventType - The investment event type.
     * @param exDate - The ex-dividend date.
     * @param recordDate - The record date.
     * @param paymentDate - The payment date.
     * @param amountPerUnit - The dividend amount per unit.
     * @param currency - The currency of the dividend amount.
     */
    create(
        securityId: number,
        eventType: "DIVIDEND",
        exDate: string,
        recordDate: string,
        paymentDate: string,
        amountPerUnit: number,
        currency: string
    ) {
        const result = this.db
            .prepare(`
            INSERT INTO investment_events (
                security_id,
                event_type,
                ex_date,
                record_date,
                payment_date,
                amount_per_unit,
                currency
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
            .run(
                securityId,
                eventType,
                exDate,
                recordDate,
                paymentDate,
                amountPerUnit,
                currency
            );

        // Reload the row so create returns the same shape as repository reads.
        return this.findById(Number(result.lastInsertRowid));
    }


}
