import type Database from "better-sqlite3";

export class InvestmentEventRepository {
    constructor(private readonly db: Database.Database) { }


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
