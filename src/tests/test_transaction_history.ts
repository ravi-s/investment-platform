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

console.log(
    "Change 2026-09-22 to 2026-09-23:",
    transactionService.getHoldingChange(
        1,
        1,
        "2026-09-22",
        "2026-09-23"
    )
);

console.log(
    "Reliance transactions on 2026-09-23:",
    transactionService.findTransactionsForSecurity(
        1,
        1,
        "2026-09-23",
        "2026-09-23"
    )
);

console.log(
    "TCS transactions:",
    transactionService.findTransactionsForSecurity(
        1,
        2,
        "2026-09-22",
        "2026-09-23"
    )
);
console.log(
    "Securities held on 2026-09-23:",
    transactionService.findSecuritiesHeldAsOf(
        1,
        "2026-09-23"
    )
);

console.log(
    "Securities held on 2026-09-21:",
    transactionService.findSecuritiesHeldAsOf(
        1,
        "2026-09-21"
    )
);