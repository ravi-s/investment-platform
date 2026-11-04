import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";

import { ImportHistoryRepository } from "../repositories/import-history.js";
import { PortfolioRepository } from "../repositories/portfolio.js";
import { TransactionImportBatchItemRepository } from "../repositories/transaction-import-batch-item.js";
import { TransactionImportBatchRepository } from "../repositories/transaction-batch-import.js";
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

/** Identifies failures caused by malformed CSV input or invalid CSV values. */
export class CsvImportValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CsvImportValidationError";
    }
}

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
        throw new CsvImportValidationError(
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
            throw new CsvImportValidationError(
                `Invalid CSV row ${rowNumber}: ${header} is required`
            );
        }
        return value.trim();
    };

    const transactionDate = valueFor("transactionDate");
    // Reuse the application's date schema for format and calendar-date validation.
    const parsedDate = DateOnlySchema.safeParse(transactionDate);
    if (!parsedDate.success) {
        throw new CsvImportValidationError(
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
        throw new CsvImportValidationError(
            `Invalid CSV row ${rowNumber}: securityId must be a positive integer`
        );
    }

    const type = valueFor("type");
    if (type !== "BUY" && type !== "SELL") {
        throw new CsvImportValidationError(
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
    private readonly portfolioRepository: PortfolioRepository;
    private readonly importHistoryRepository: ImportHistoryRepository;
    private readonly transactionImportBatchRepository: TransactionImportBatchRepository;
    private readonly transactionImportBatchItemRepository: TransactionImportBatchItemRepository;

    constructor(private readonly db: Database.Database) {
        this.transactionService = new TransactionService(db);
        this.portfolioRepository = new PortfolioRepository(db);
        this.importHistoryRepository = new ImportHistoryRepository(db);
        this.transactionImportBatchRepository = new TransactionImportBatchRepository(db);
        this.transactionImportBatchItemRepository = new TransactionImportBatchItemRepository(db);
    }
    private parseAndValidateCsv(csv: string): CsvTransaction[] {
        let records: string[][];
        try {
            records = parseCsvRecords(csv);
        } catch (error) {
            // Normalize CSV syntax/parser failures without changing transaction errors.
            const message = error instanceof Error ? error.message : String(error);
            throw new CsvImportValidationError(`Invalid CSV: ${message}`);
        }

        const [header, ...rows] = records;
        if (!header) {
            throw new CsvImportValidationError("Invalid CSV: header row is required");
        }

        const normalizedHeader = header.map(value => value.trim());
        const indexes = new Map<string, number>();

        // Reject empty or duplicate names before building the column lookup.
        normalizedHeader.forEach((name, index) => {
            if (name === "") {
                throw new CsvImportValidationError("Invalid CSV: header names must not be empty");
            }
            if (indexes.has(name)) {
                throw new CsvImportValidationError(`Invalid CSV: duplicate header ${name}`);
            }
            indexes.set(name, index);
        });

        for (const name of requiredHeaders) {
            if (!indexes.has(name)) {
                throw new CsvImportValidationError(`Invalid CSV: missing required header ${name}`);
            }
        }

        // The header is CSV row 1, so the first data record is row 2.
        // Validate every data record before writing any transactions.
        return rows.map((fields, index) => {
            const rowNumber = index + 2;
            if (fields.length !== normalizedHeader.length) {
                throw new CsvImportValidationError(
                    `Invalid CSV row ${rowNumber}: expected ${normalizedHeader.length} fields, received ${fields.length}`
                );
            }

            return parseTransaction(fields, indexes, rowNumber);
        });
    }
    /**
     * Validates the CSV and delegates each row to the standard transaction
     * service. The database transaction ensures that any failure rolls back
     * all transactions created by this import.
     */
    importCsv(userId: number, portfolioId: number, csv: string) {
        return this.db.transaction(() => {
            const portfolio = this.portfolioRepository.findById(portfolioId);
            if (!portfolio || portfolio.user_id !== userId) {
                throw new Error("Portfolio not found");
            }

            const transactions = this.parseAndValidateCsv(csv);

            if (transactions.length === 0) {
                return [];
            }

            const contentHash = createHash("sha256").update(csv).digest("hex");
            if (this.importHistoryRepository.exists(userId, portfolioId, contentHash)) {
                throw new Error("CSV file has already been imported");
            }

            const importedTransactions = transactions.map(transaction =>
                this.transactionService.create(
                    portfolioId,
                    transaction.securityId,
                    transaction.type,
                    transaction.quantity,
                    transaction.price,
                    transaction.transactionDate
                )
            );

            this.importHistoryRepository.create(userId, portfolioId, contentHash);

            return importedTransactions;
        })();
    }

    /**
     * Validates and persists a CSV as a staged import batch without creating
     * transactions or recording the file in import history.
     */
    stageCsv(userId: number, portfolioId: number, csv: string) {
        return this.db.transaction(() => {
            const portfolio = this.portfolioRepository.findById(portfolioId);
            if (!portfolio || portfolio.user_id !== userId) {
                throw new Error("Portfolio not found");
            }

            const transactions = this.parseAndValidateCsv(csv);

            if (transactions.length === 0) {
                throw new Error("CSV contains no transactions to stage");
            }
            const contentHash = createHash("sha256").update(csv).digest("hex");

            if (
                this.importHistoryRepository.exists(
                    userId,
                    portfolioId,
                    contentHash
                ) ||
                this.transactionImportBatchRepository.exists(
                    userId,
                    portfolioId,
                    contentHash
                )
            ) {
                throw new Error("CSV file has already been imported or staged");
            }

            const batch = this.transactionImportBatchRepository.create(
                userId,
                portfolioId,
                contentHash
            );
            const items = this.transactionImportBatchItemRepository.createMany(
                batch.id,
                transactions.map((transaction, index) => ({
                    source_row: index + 2,
                    transaction_date: transaction.transactionDate,
                    security_id: transaction.securityId,
                    type: transaction.type,
                    quantity: transaction.quantity,
                    price: transaction.price,
                }))
            );

            return { batch, items };
        })();
    }

    /**
     * Applies a previously staged transaction import batch atomically.
     * All transactions, holdings, import history, and batch status
     * changes are committed together or rolled back together.
     */
    applyStagedBatch(
        userId: number,
        portfolioId: number,
        batchId: number
    ) {
        return this.db.transaction(() => {
            const portfolio = this.portfolioRepository.findById(portfolioId);

            if (!portfolio || portfolio.user_id !== userId) {
                throw new Error("Portfolio not found");
            }

            const batch = this.transactionImportBatchRepository.findById(batchId);

            if (
                !batch ||
                batch.user_id !== userId ||
                batch.portfolio_id !== portfolioId
            ) {
                throw new Error("Import batch not found");
            }

            if (batch.status !== "STAGED") {
                throw new Error("Import batch is not in STAGED status");
            }

            const items =
                this.transactionImportBatchItemRepository.findByBatchId(batchId);

            if (items.length === 0) {
                throw new Error("Import batch contains no transactions");
            }

            const importedTransactions = items.map(item =>
                this.transactionService.create(
                    portfolioId,
                    item.security_id,
                    item.type,
                    item.quantity,
                    item.price,
                    item.transaction_date
                )
            );

            this.importHistoryRepository.create(
                userId,
                portfolioId,
                batch.content_hash
            );

            const transitioned =
                this.transactionImportBatchRepository.transitionStatus(
                    batchId,
                    "APPLIED"
                );

            if (!transitioned) {
                throw new Error("Failed to transition import batch to APPLIED");
            }

            return importedTransactions;
        })();
    }

    /** Retrieves a transaction import batch by ID. */
    findBatchById(batchId: number) {
        return this.transactionImportBatchRepository.findById(batchId);
    }

    /** Retrieves all staged transaction rows belonging to a batch. */
    findBatchItems(batchId: number) {
        return this.transactionImportBatchItemRepository.findByBatchId(
            batchId
        );
    }

}
