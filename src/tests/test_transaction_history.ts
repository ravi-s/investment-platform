// src/test-history.ts

import { TransactionService } from "../services/transaction.js";

const transactionService = new TransactionService();

console.log(
    "2026-09-21:",
    transactionService.getHoldingAsOf(1, 1, "2026-09-21")
);

console.log(
    "2026-09-22:",
    transactionService.getHoldingAsOf(1, 1, "2026-09-22")
);


console.log(
    "2026-09-23:",
    transactionService.getHoldingAsOf(1, 1, "2026-09-23")
);