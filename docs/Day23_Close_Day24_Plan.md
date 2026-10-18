# Investment Platform — Day 23 Close and Day 24 Plan

**Date:** October 18, 2026  
**Principle:** Test first. Implement next. Verify always.  
**Canonical source:** GitHub repository

## Day 23 closeout

### Completed
- Added `src/tests/security-route.test.ts` with six tests for the public security reference endpoints: security lookup, missing security, invalid ID, NSE listing, BSE listing, and missing listing.
- Added database dependency injection to `SecurityService`, retaining the application database as the default.
- Added optional service injection to `securityRoutes`.
- Kept security reference-data routes public and read-only.

### Verification
- Focused security-route tests: **6 passed**.
- Full suite: **21 test files passed; 196 tests passed**.
- `npm run build`: successful, confirmed by the developer.

The developer confirms the important domain routes already have test coverage. Do not continue route-by-route test expansion simply to increase the test count. Revisit route security only when a concrete defect or requirement gap is identified.

## Day 24 proposal — Transaction CSV Import: Requirements First

### Objective
Start a new domain capability rather than extend the route-audit loop: define a safe first increment for importing transactions from CSV.

### Work sequence
1. Inspect the existing transaction model, validation, service API, and database constraints.
2. Define the CSV file/column contract before implementation.
3. Specify validation for dates, quantity, price, transaction type, and security/listing.
4. Decide import atomicity. Proposed default: all-or-nothing, to prevent partial portfolio updates.
5. Define duplicate-import behavior before implementation.
6. Write acceptance tests first: valid file, malformed rows, invalid fields, unknown security/listing, duplicate import, and no financial side effects on rejection.
7. Implement only after the requirements and tests are reviewed.
8. Run focused tests, full regression tests, and `npm run build`.

### Out of scope
- Excel/PDF parsing.
- Broker-specific format adapters.
- Background jobs or asynchronous processing.
- Frontend upload UI.
- Reworking existing routes without a concrete defect.

### Definition of done for the requirements increment
- CSV contract and row-level error behavior documented.
- Atomicity and duplicate handling explicitly decided.
- Acceptance tests agreed before implementation.
- Existing transaction semantics remain the source of truth.

This is a proposed plan; no CSV import implementation is claimed complete.


## Carry-over items from the October 16 tracker

The prior tracker explicitly identified two contract items. Their completion was not verified during this Day 23 review, so preserve them as open/deferred rather than silently marking them done:

- **Portfolio creation request schema:** the previous tracker noted that `CreatePortfolioSchema` required `userId` even though ownership is derived from the authenticated session. Verify current status before deciding whether a small contract cleanup is still needed.
- **`GET /api/users/:id` visibility:** the intended access contract was still a decision item. Define the contract only when this endpoint's visibility becomes the focus; do not restart a broad route audit because of it.

These carry-over items are separate from the decision to stop adding route tests without a concrete gap.
