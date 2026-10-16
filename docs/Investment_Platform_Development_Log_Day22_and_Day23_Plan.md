# Investment Platform — Development Log: Day 22 and Day 23 Plan

## Day 22 — Friday, October 16, 2026

### Goal
Implement ownership authorization on top of the Day 21 authentication/session boundary.

### Completed

- Added cross-user ownership coverage for portfolio retrieval.
- Enforced ownership checks on portfolio retrieval and valuation.
- Added authentication and ownership checks to current holdings.
- Added authentication and ownership checks to historical holdings.
- Added authentication and ownership checks to performance.
- Protected portfolio creation with authentication and derived the owner from `request.authenticatedUserId` rather than trusting the body `userId`.
- Used test-first development for each gap and preserved existing financial-domain behavior.

### Verification

**Reported final test result:** 18 test files passed; 173 tests passed.  
This is the end-of-day checkpoint reported by the developer.

### Follow-up noted during source review

`CreatePortfolioSchema` still requires `userId` in the request body even though the handler derives ownership from the session. Day 23 should make the request contract consistent with the security rule and test that portfolio creation succeeds without a body `userId`.

### Not yet complete

Portfolio-level authorization does not imply all API routes are secure. Direct holding/transaction lookups, holding/transaction writes, transaction-history queries, historical quantity routes, and the user-by-ID visibility contract remain to be reviewed and tested.

---

## Day 23 — Saturday, October 17, 2026

### Objective
Complete the next increment of the API authorization boundary without expanding into generalized permissions or unrelated refactoring.

### Planned sequence

1. Review route registration and build a route-by-route authorization inventory.
2. Add a failing cross-user test for `GET /api/holdings/:id`; enforce authorization through the parent portfolio.
3. Add a failing cross-user test for `GET /api/transactions/:id`; enforce authorization through the parent portfolio.
4. Test `POST /api/portfolios/:portfolioId/holdings` and `POST /api/transactions` against cross-user writes. Assert rejected requests do not change holdings, transactions, or other financial records.
5. Review portfolio transaction history, security-specific transaction queries, historical holding quantities, and quantity-change endpoints for ownership enforcement.
6. Remove `userId` as a required client field from portfolio creation input; retain tests proving a submitted foreign `userId` cannot override the session identity.
7. Define and test the intended access behavior for `GET /api/users/:id`.
8. Run the full regression suite and record the actual result.

### Definition of done

- Each relevant route is explicitly classified and protected appropriately.
- Owner access works.
- Unauthenticated requests are rejected where authentication is required.
- Cross-user reads/writes are denied.
- Denied writes have no financial side effects.
- Existing financial calculations and behavior remain unchanged.
- Full regression result is recorded; unresolved routes remain marked partial rather than complete.

### Working method

Continue test-first, one route or closely related route group at a time. Do not add RBAC, a generic permission framework, frontend work, or unrelated refactoring during this security increment.
