import { parse } from "csv-parse/sync";
import { DateOnlySchema } from "../schema/date.js";
import { SecurityRepository } from "../repositories/security.js";

export type AdaptedHistoricalTransaction = {
    sourceRow: number;
    transactionDate: string;
    securityId: number;
    type: "BUY" | "SELL";
    quantity: number;
    price: number;
    sourceFile: string;
    sourceRowNumber: number;
    isin: string;
    tradeId: string | null;
    orderId: string | null;
};

type HistoricalCsvRow = {
    isin: string;
    trade_date: string;
    trade_type: string;
    quantity: string;
    price: string;
    trade_id: string;
    order_id: string;
    source_file: string;
    source_row_number: string;
};

export class HistoricalTransactionAdapter {
    constructor(
        private readonly securityRepository: SecurityRepository
    ) { }

    adapt(csv: string): AdaptedHistoricalTransaction[] {
        const records = parse(csv, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as HistoricalCsvRow[];

        return records.map((row, index) => {
            const isin = row.isin?.trim();

            if (!isin) {
                throw new Error(`Missing ISIN at CSV row ${index + 2}`);
            }

            const security = this.securityRepository.findByIsin(isin);

            if (!security) {
                throw new Error(
                    `No security found for ISIN ${isin} at CSV row ${index + 2}`
                );
            }

            const transactionType = row.trade_type?.trim().toLowerCase();

            if (transactionType !== "buy" && transactionType !== "sell") {
                throw new Error(
                    `Invalid transaction type at CSV row ${index + 2}`
                );
            }

            const quantity = Number(row.quantity);
            const price = Number(row.price);
            const sourceRowNumber = Number(row.source_row_number);

            if (!Number.isFinite(quantity) || quantity <= 0) {
                throw new Error(`Invalid quantity at CSV row ${index + 2}`);
            }

            if (!Number.isFinite(price) || price <= 0) {
                throw new Error(`Invalid price at CSV row ${index + 2}`);
            }

            if (
                !Number.isInteger(sourceRowNumber) ||
                sourceRowNumber <= 0
            ) {
                throw new Error(
                    `Invalid source row number at CSV row ${index + 2}`
                );
            }

            const dateResult = DateOnlySchema.safeParse(row.trade_date);

            if (!dateResult.success) {
                throw new Error(
                    `Invalid transaction date at CSV row ${index + 2}`
                );
            }

            if (!row.source_file?.trim()) {
                throw new Error(
                    `Missing source file at CSV row ${index + 2}`
                );
            }

            return {
                sourceRow: index + 2,
                transactionDate: dateResult.data,
                securityId: security.id,
                type: transactionType.toUpperCase() as "BUY" | "SELL",
                quantity,
                price,
                sourceFile: row.source_file.trim(),
                sourceRowNumber,
                isin,
                tradeId: row.trade_id?.trim() || null,
                orderId: row.order_id?.trim() || null,
            };
        });
    }
}