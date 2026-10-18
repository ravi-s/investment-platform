# Investment Platform — Master Requirements Amendment

**Update date:** October 18, 2026  
**Purpose:** Record the Day 23 verification checkpoint and define the next domain increment. This amendment supplements the existing master requirements; it does not replace unrelated requirements.

## 1. API route test checkpoint
At the end of Day 23, the developer reported **21 test files passed, 196 tests passed, and a successful TypeScript build**.

The developer confirms the important domain routes have been covered by tests. Avoid adding more route tests by default. Further route-security work requires a specific requirement or reproducible defect.

## 2. Security reference-data routes
Public read-only endpoints tested:
- `GET /api/securities/:id`
- `GET /api/securities/:exchange/:symbol`

Coverage includes successful lookups, missing records, invalid numeric IDs, and NSE/BSE listing lookups. `SecurityService` supports database injection for isolated tests; `securityRoutes` supports service injection. These endpoints remain public.

## 3. Next capability: transaction CSV import

### Goal
Import transaction records from CSV while preserving existing domain rules and reducing manual entry.

### Requirements to define before implementation
1. CSV file and column contract, including required and optional fields.
2. Validation for dates, quantity, price, transaction type, exchange/listing, and security.
3. Row-numbered, actionable errors that do not expose internal stack traces.
4. Atomicity. Proposed initial policy: all-or-nothing file import.
5. Duplicate handling and repeated-import policy.
6. Reuse existing transaction validation/service logic; do not bypass the domain service with direct inserts.
7. Rejected imports must leave transactions, holdings, and derived financial state unchanged.
8. Preserve FIFO, stock split, dividend, historical valuation, and performance semantics.
9. CSV only in the first increment. Excel, PDF, broker-specific adapters, background processing, and upload UI are separate future scope.

### Acceptance-test themes
- Valid file creates the expected transactions.
- Invalid header or malformed row returns a clear client error.
- Invalid dates, numbers, transaction types, or securities/listings are rejected.
- Unknown/ambiguous listings are handled explicitly.
- Repeated import follows the agreed duplicate policy.
- Rejected imports cause no financial-record changes.
- Existing transaction-domain tests remain green.

Do not mark CSV import implemented until requirements, tests, implementation, and full regression verification are complete.


## Carry-over items from the October 16 tracker

The prior tracker explicitly identified two contract items. Their completion was not verified during this Day 23 review, so preserve them as open/deferred rather than silently marking them done:

- **Portfolio creation request schema:** the previous tracker noted that `CreatePortfolioSchema` required `userId` even though ownership is derived from the authenticated session. Verify current status before deciding whether a small contract cleanup is still needed.
- **`GET /api/users/:id` visibility:** the intended access contract was still a decision item. Define the contract only when this endpoint's visibility becomes the focus; do not restart a broad route audit because of it.

These carry-over items are separate from the decision to stop adding route tests without a concrete gap.
