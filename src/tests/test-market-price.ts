import { MarketPriceService } from "../services/market-price.js";

const service = new MarketPriceService();

console.log(
    "RELIANCE NSE price:",
    service.create(
        "NSE",
        "RELIANCE",
        "2026-09-23",
        2650
    )
);

console.log(
    "RETRIEVED:",
    service.findByListingAndDate(
        "NSE",
        "RELIANCE",
        "2026-09-23"
    )
);

// Failure test case: attempting to create a market price for the same listing and date should fail
service.create(
    "NSE",
    "RELIANCE",
    "2026-09-23",
    2655
);
// Failure test case: attempting to create a market price with a non-positive close price should fail
service.create(
    "NSE",
    "RELIANCE",
    "2026-09-24",
    0
);