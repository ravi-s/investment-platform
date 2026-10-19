import type Database from "better-sqlite3";
import { parse } from "csv-parse/sync";

import { DateOnlySchema } from "../schema/date.js";
import { TransactionService } from "./transaction.js";

type TransactionType = "BUY" | "SELL";

type CsvTransaction = {
    transactionDate: string;
    securityId: number;
    type: TransactionType;
    quantity: number;
    price: number;
};

/** CSV columns that must be present to create a transaction. */
const requiredHeaders = [
    "transactionDate",
    "securityId",
    "type",
    "quantity",
    "price",
] as const;

function parseCsvRecords(csv: string): string[][] {
    return parse(csv, {
        bom: true,
        skip_empty_lines: true,
    });
}

/** Parses a strictly positive finite number and reports its CSV location on error. */
function parsePositiveNumber(value: string, fieldName: string, rowNumber: number): number {
    const normalized = value.trim();
    const parsed = Number(normalized);
    if (
        !/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized) ||
        !Number.isFinite(parsed) ||
        parsed <= 0
    ) {
        throw new Error(
            `Invalid CSV row ${rowNumber}: ${fieldName} must be a positive number`
        );
    }
    return parsed;
}

function parseTransaction(
    fields: string[],
    indexes: Map<string, number>,
    rowNumber: number
): CsvTransaction {
    // Resolve values by header name so columns can appear in any order.
    const valueFor = (header: typeof requiredHeaders[number]) => {
        const index = indexes.get(header);
        const value = index === undefined ? undefined : fields[index];
        if (value === undefined || value.trim() === "") {
            throw new Error(
                `Invalid CSV row ${rowNumber}: ${header} is required`
            );
        }
        return value.trim();
    };

    const transactionDate = valueFor("transactionDate");
    // Reuse the application's date schema for format and calendar-date validation.
    const parsedDate = DateOnlySchema.safeParse(transactionDate);
    if (!parsedDate.success) {
        throw new Error(
            `Invalid CSV row ${rowNumber}: transactionDate must be a valid YYYY-MM-DD date`
        );
    }

    const securityId = parsePositiveNumber(
        valueFor("securityId"),
        "securityId",
        rowNumber
    );
    // A security identifier must be a whole number, not merely a positive decimal.
    if (!Number.isSafeInteger(securityId)) {
        throw new Error(
            `Invalid CSV row ${rowNumber}: securityId must be a positive integer`
        );
    }

    const type = valueFor("type");
    if (type !== "BUY" && type !== "SELL") {
        throw new Error(
            `Invalid CSV row ${rowNumber}: type must be BUY or SELL`
        );
    }

    return {
        transactionDate: parsedDate.data,
        securityId,
        type,
        quantity: parsePositiveNumber(
            valueFor("quantity"),
            "quantity",
            rowNumber
        ),
        price: parsePositiveNumber(valueFor("price"), "price", rowNumber),
    };
}

/** Imports transaction rows from CSV, applying normal transaction rules atomically. */
export class TransactionImportService {
    private readonly transactionService: TransactionService;

    constructor(private readonly db: Database.Database) {
        this.transactionService = new TransactionService(db);
    }

    /**
     * Validates the CSV and delegates each row to the standard transaction
     * service. The database transaction ensures that any failure rolls back
     * all transactions created by this import.
     */
    importCsv(portfolioId: number, csv: string) {
        return this.db.transaction(() => {
            const [header, ...rows] = parseCsvRecords(csv);
            if (!header) {
                throw new Error("Invalid CSV: header row is required");
            }

            const normalizedHeader = header.map(value => value.trim());
            const indexes = new Map<string, number>();

            // Reject empty or duplicate names before building the column lookup.
            normalizedHeader.forEach((name, index) => {
                if (name === "") {
                    throw new Error("Invalid CSV: header names must not be empty");
                }
                if (indexes.has(name)) {
                    throw new Error(`Invalid CSV: duplicate header ${name}`);
                }
                indexes.set(name, index);
            });

            for (const name of requiredHeaders) {
                if (!indexes.has(name)) {
                    throw new Error(`Invalid CSV: missing required header ${name}`);
                }
            }

            // The header is CSV row 1, so the first data record is row 2.
            // Validate every data record before writing any transactions.
            const transactions = rows.map((fields, index) => {
                const rowNumber = index + 2;
                if (fields.length !== normalizedHeader.length) {
                    throw new Error(
                        `Invalid CSV row ${rowNumber}: expected ${normalizedHeader.length} fields, received ${fields.length}`
                    );
                }

                return parseTransaction(fields, indexes, rowNumber);
            });

            return transactions.map(transaction =>
                this.transactionService.create(
                    portfolioId,
                    transaction.securityId,
                    transaction.type,
                    transaction.quantity,
                    transaction.price,
                    transaction.transactionDate
                )
            );
        })();
    }
}
