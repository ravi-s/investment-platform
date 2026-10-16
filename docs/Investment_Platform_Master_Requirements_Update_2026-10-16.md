# Investment Platform — Master Requirements Update

**Update date:** October 16, 2026  
**Applies to:** `Investment_Platform_Master_Requirements_Draft_Updated.md`  
**Purpose:** Record the implementation progress and clarify remaining security acceptance criteria. This update supplements existing requirements; it does not replace unrelated domain requirements.

## 1. Authentication and portfolio-level authorization progress

Authentication and session enforcement were implemented and regression-tested by the end of Day 21. On Day 22, ownership checks were added to the reviewed portfolio routes:

- `GET /api/portfolios/:id`
- `GET /api/portfolios/:id/holdings`
- `GET /api/portfolios/:id/holdings/as-of`
- `GET /api/portfolios/:id/valuation`
- `GET /api/portfolios/:id/performance`
- `POST /api/portfolios`

The server uses trusted authentication state (`request.authenticatedUserId`) to identify the requester. Portfolio creation derives the owner from that identity instead of allowing the request body to choose the owner.

For reviewed protected routes, unauthenticated requests are expected to return `401`; cross-user access to a portfolio is expected to return `404` so that the endpoint does not reveal whether another user's portfolio exists.

## 2. Security invariants remain broader than the Day 22 implementation

The requirement is not complete until every relevant API access path enforces the same invariants. Remaining areas to review and verify include:

- Direct holding lookup and holding creation.
- Transaction creation and direct transaction lookup.
- Portfolio transaction history and security-specific transaction queries.
- Historical holding quantity and quantity-change queries.
- Any other endpoint returning portfolio-owned investment data.
- The access contract for `GET /api/users/:id`.
- Denied writes must leave transactions, holdings, and all financial records unchanged.

Direct holding and transaction lookups must authorize through the parent portfolio, not merely by checking that the resource ID exists.

## 3. Portfolio creation request contract

The authenticated identity must be the sole source of portfolio ownership. The current implementation ignores the submitted `userId` for ownership, but the schema still requires that field. Clarify the API contract so the client supplies the portfolio's actual editable fields (currently `name`) and does not need to send an owner ID. Add a regression test for successful creation without a body `userId`, while retaining a malicious-body-ID test proving the owner cannot be overridden.

## 4. Verification baseline

At the end of Day 22, the developer reported **18 test files passed and 173 tests passed**. This is a recorded project checkpoint, not a claim that all authorization requirements are now complete.

## 5. Next implementation phase

Day 23 should finish the API security boundary route by route, using test-first development. Prioritize direct holding/transaction access, write authorization and no-side-effect tests, and remaining historical/history query routes. Do not begin a generalized role/permission framework; ownership-based access is the current requirement.
