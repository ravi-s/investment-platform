# Investment Platform — Implementation Tracker Update

**Update date:** October 12, 2026  
**Companion tracker:** `Investment_Platform_Implementation_Requirements_Tracking_Master.md`  
**Companion requirements:** `Investment_Platform_Master_Requirements_Draft_Updated.md`  
**Purpose:** Authoritative status amendments for the tracker. These updates supersede conflicting older status notes but do not replace unrelated tracker entries.

---

## 1. Current Development Baseline — Day 20

- **Latest reported automated test status:** 121 tests passing.
- XIRR validation now rejects impossible calendar dates such as `2026-02-30`; the regression test passes.
- Debug logging introduced during earlier troubleshooting was removed before this baseline.
- No authentication or authorization mechanism has been implemented yet. This was not part of the previous scope; it is now a prioritized requirement.

Do not interpret the 121-test baseline as evidence of security coverage. Existing route tests currently exercise requests without an authenticated identity, and must be adapted when authentication is introduced.

## 2. Status Changes

Use the existing tracker status definitions: Complete, Partial, Not Started, and Deferred.

| Requirement | Updated status | Evidence / notes |
|---|---|---|
| User persistence and basic user attributes | ✅ Complete | Existing user entity/repository/API and tests support the current basic user model. |
| Authentication | ⬜ Not Started — prioritized | No authentication hook, plugin, session/token mechanism, or trusted requester identity currently exists. Newly prioritized on 2026-10-12; it was not part of the earlier implementation scope. |
| Authorization / portfolio ownership | ⬜ Not Started — prioritized | Current routes/services retrieve resources by ID or accept portfolio/user IDs without establishing requester ownership. Enforce ownership across all portfolio-owned data paths. |
| Direct holding lookup authorization | ⬜ Not Started | `GET /api/holdings/:id` retrieves by holding ID; authorization must resolve through the parent portfolio. |
| Direct transaction lookup authorization | ⬜ Not Started | `GET /api/transactions/:id` retrieves by transaction ID; authorization must resolve through the parent portfolio. |
| Cross-user security regression coverage | ⬜ Not Started | Add tests for unauthenticated requests, authorized owner access, cross-user reads, cross-user writes, and no financial side effects on denied writes. |
| Responsive mobile-first web UI | ⬜ Not Started | Product direction clarified: initial delivery is web-first, but design should be mobile-first and efficient on narrow screens. |
| Native mobile application | 🔵 Deferred | Keep as a future client option; do not make native app development a prerequisite for the first web release. |
| Offline behavior / synchronization | 🔵 Deferred | Remains future scope; do not let it drive premature architecture. |

## 3. Known Authorization Exposure Inventory

The route inventory reviewed on October 12 identifies these areas for protection:

- `POST /api/portfolios`: currently accepts `userId` from the request body.
- `GET /api/portfolios/:id` and portfolio subroutes: ownership is not checked.
- `POST /api/portfolios/:portfolioId/holdings` and `GET /api/holdings/:id`.
- `POST /api/transactions` and `GET /api/transactions/:id`.
- Portfolio transaction history, security-specific transaction queries, historical holding queries, and securities-held-as-of routes.
- Portfolio valuation and performance routes.
- `GET /api/users/:id`: retrieves a user by ID without an access-control check; its intended visibility should be specified before being protected or redesigned.

This is an implementation inventory, not proof that the list is exhaustive. Re-scan route registration and all route modules when adding the authentication boundary.

## 4. Next Implementation Sequence

### Step 1 — Finalize the security boundary

- Choose the initial authentication approach for a browser-based web application while keeping future mobile API access in mind.
- Establish a trusted authenticated-user identity on requests.
- Do not trust a request body, query parameter, or arbitrary header as the authenticated user ID.

### Step 2 — Test first

Add focused tests for:

1. Protected data cannot be accessed without authentication.
2. An authenticated owner can access their own portfolio and data.
3. Another user cannot read the portfolio or its holdings/transactions by guessing IDs.
4. Another user cannot create or mutate transactions/holdings in the portfolio.
5. Denied writes leave transactions and holdings unchanged.
6. Direct holding and transaction ID lookups enforce the same ownership rule.

### Step 3 — Implement the smallest coherent solution

- Enforce portfolio ownership consistently at the route/service boundary.
- Prefer shared, explicit enforcement over copy-pasted checks that can drift.
- Keep financial calculations and domain behavior unchanged unless security requires a change.
- Do not add role-based access control or a generalized permissions framework without a concrete requirement.

### Step 4 — Verify

- Update route-test setup to represent authenticated users explicitly.
- Run the full suite and record the actual test count and failures.
- Do not mark security requirements complete until the corresponding tests and implementation evidence exist.

## 5. Product Delivery Direction

- **Development/delivery:** web-first.
- **Experience design:** mobile-first responsive web.
- **Future client:** native mobile remains possible, not committed.
- **API/domain:** keep financial business logic independent of UI and reusable by future clients.
- **Pilot readiness:** authentication and ownership authorization must be addressed before exposing real user financial data to multiple users.

## 6. Tracker Maintenance Rule

The Master Requirements document remains the source of truth for product and domain requirements. This tracker remains the source of truth for implementation status and evidence. When security work progresses, update both documents only where the requirement or scope changes; update this tracker with the exact implementation and test evidence. Do not mark authentication or authorization complete merely because middleware exists—every relevant access path must be covered.
