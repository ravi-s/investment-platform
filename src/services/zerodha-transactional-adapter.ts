import { parse } from "csv-parse/sync";
import { DateOnlySchema } from "../schema/date.ts";
import { SecurityRepository } from "../repositories/security.ts";

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
    signed_units: string;
    validation_flag: string;
};

export class ZerodhaTransactionAdapter {
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
            const signedUnits = Number(row.signed_units);

            if (
                !Number.isFinite(signedUnits) ||
                Math.abs(Math.abs(signedUnits) - quantity) > 1e-9
            ) {
                throw new Error(
                    `Invalid signed_units at CSV row ${index + 2}`
                );
            }

            const expectedSign = transactionType === "buy" ? 1 : -1;

            if (Math.sign(signedUnits) !== expectedSign) {
                throw new Error(
                    `Invalid signed_units sign at CSV row ${index + 2}`
                );
            }

            const allowedValidationFlags = new Set([
                "MATCHED_TO_ORIGINAL_ANNUAL_EXPORTS",
                "COMPLETE_CALENDAR_YEAR_EXPORT",
                "CURRENT_HOLDINGS_ISIN",
            ]);

            if (!allowedValidationFlags.has(row.validation_flag?.trim())) {
                throw new Error(
                    `Invalid validation_flag at CSV row ${index + 2}`
                );
            }

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