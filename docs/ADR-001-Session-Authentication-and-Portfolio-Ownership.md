# ADR-001: Session Authentication and Portfolio Ownership Authorization

**Status:** Accepted / implemented for reviewed portfolio routes  
**Decision date:** October 2026  
**Context:** The platform is web-first with a mobile-first responsive experience planned. It handles user-owned financial data and must not trust client-supplied user IDs as proof of identity or ownership.

## Decision

1. Use the existing session-based authentication mechanism for the initial browser application.
2. The authentication guard validates the session and places the trusted identity on `request.authenticatedUserId`.
3. Protected routes reject unauthenticated requests with `401`.
4. Portfolio-owned resources are accessible only when the resource's portfolio owner matches the authenticated user ID.
5. For reviewed portfolio routes, missing or non-owned portfolios return `404` to avoid disclosing another user's resource existence.
6. Portfolio creation derives `user_id` from `request.authenticatedUserId`; a client-supplied `userId` must never override it.
7. Enforce ownership before reading or calculating sensitive portfolio data and before mutating financial records.
8. Do not introduce generalized RBAC or a permissions framework without a concrete requirement.

## Consequences

- Route tests must cover unauthenticated access, owner access, cross-user denial, and denied-write side effects.
- Direct holding and transaction lookups must resolve authorization through the parent portfolio.
- This ADR covers the chosen approach; it does not claim every route has already been secured. The implementation tracker records route-level status.
- The portfolio-creation schema should stop requiring a client-supplied `userId`, because the server is authoritative for ownership.

## Verification at Day 22 close

The developer reported 173 passing tests across 18 test files. Reviewed portfolio retrieval, holdings, historical holdings, valuation, performance, and creation flows have authentication/ownership behavior covered. Other holding/transaction routes remain for Day 23 review.
