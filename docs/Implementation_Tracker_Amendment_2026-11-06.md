# Personal Investment & Portfolio Platform — Implementation Tracker Amendment

**Amendment date:** November 6, 2026  
**Development checkpoint:** Day 30 — staged transaction import failure-path integrity verified  
**Companion requirements:** `Master_Requirements_Amendment_2026-11-06.md`  
**Supersedes checkpoint:** November 5, 2026 (Day 29)  
**Purpose:** Carry forward the November 5 tracker with verified Day 30 outcomes and establish a proposed Day 31 test-first increment.

## 1. Verified checkpoint — Day 30

### Day 30 — Failure-path integrity and retry verification

Service-level tests in `transaction-import.test.ts` cover:
- Insufficient holdings during apply; rollback preserves financial state, import history, `STAGED` status, and staged items.
- Import-history persistence failure; application writes roll back.
- Batch status-transition failure; transactions, holdings, and import-history writes roll back and the batch remains `STAGED`.
- Successful retry of the same staged batch after a simulated status-transition failure.

Route-level test in `transaction-route.test.ts` covers:
- A staged batch containing BUY 5 followed by SELL 6 with no existing holding.
- Apply returns `409` with `{ error: "Insufficient holding" }`.
- No transactions, holdings, or successful import-history rows persist.
- Batch remains `STAGED`, `applied_at` remains null, and both staged items remain.

### Day 30 verification results

- Focused `transaction-route.test.ts`: **51 tests passed**.
- Full Vitest regression suite: **257 tests passed across 25 test files**.
- `npm run build` (`tsc`): **passed**.
- Git status reported branch `main` up to date with `origin/main`.

The results above are recorded from developer-reported terminal output; they were not independently rerun during this document update. The supplied route-test file was reviewed and the staged-apply failure test was verified in the source.

**Day 30 is COMPLETE.**

## 2. Status tracker

| Capability / requirement | Status | Evidence / notes |
|---|---|---|
| CSV parsing and validation | ✅ Implemented | Existing CSV validation and row-level error handling. |
| Import authorization / portfolio ownership | ✅ Implemented | Authentication and ownership checks on routes/services. |
| Import history persistence | ✅ Implemented | Migration 013 and repository/tests. |
| Exact-file content hash | ✅ Implemented in import/staging flow | SHA-256 of CSV content; filename is not the identity. |
| Duplicate check within user + portfolio | ✅ Implemented | Checks successful import history and staged batches. |
| Cross-portfolio duplicate policy | 🟡 Not formally decided | Current check is scoped to user + portfolio; decide explicitly before changing scope. |
| Transaction import batches | ✅ Implemented | Migration 014 and repository/tests. |
| Staged batch items | ✅ Implemented | Bulk persistence and ordered retrieval. |
| Stage CSV API | ✅ Implemented | `POST .../transactions/import/stage`; returns batch metadata. |
| Preview staged batch API | ✅ Implemented | `GET .../transactions/import/batches/:batchId`; returns batch and items. |
| Apply staged batch API | ✅ Implemented | `POST .../transactions/import/batches/:batchId/apply`. |
| Batch apply authorization | ✅ Implemented and tested | Portfolio ownership and batch association enforced. |
| Apply only from `STAGED` | ✅ Implemented and tested | Reapplication returns `409`; no duplicate transaction creation. |
| Atomic batch application | ✅ Implemented and failure-path tested | Transactions, holdings, import history, and status transition roll back together on tested failures. |
| Failed apply preserves `STAGED` status | ✅ Verified by service and route tests | Insufficient holdings, import-history failure, and status-transition failure. |
| Retry after recoverable apply failure | ✅ Verified | Same staged batch applies successfully after the simulated status-transition failure is removed. |
| User-facing cancel/reject batch | ⏸ Deferred by decision | Do not implement until workflow need is established. |
| Editable preview/correction grid | ⏸ Deferred | Frontend/product increment. |
| Row-level duplicate/overlap detection | ⏸ Deferred | Requires transaction identity/domain design. |
| Broker execution identifiers/adapters | ⏸ Deferred | Support reliable IDs where available; no universal assumption. |
| Excel/PDF import and background processing | ⏸ Deferred | Not in current scope. |
| Concurrent application safety | 🟡 Requirement identified; verification proposed for Day 31 | Master requirement says concurrency must not permit duplicate application; add a meaningful concurrency test before claiming verified. |

## 3. Day 30 completion criteria

| Criterion | Result |
|---|---|
| Domain validation failure rolls back financial writes | ✅ Verified |
| Import-history persistence failure rolls back application | ✅ Verified |
| Batch status-transition failure rolls back application | ✅ Verified |
| Failed batch remains `STAGED` with staged items intact | ✅ Verified |
| Retry of a still-`STAGED` batch can succeed | ✅ Verified |
| Route reports insufficient holdings as HTTP 409 | ✅ Verified |
| Focused route tests | 51 passed |
| Full regression | 257 passed across 25 files |
| TypeScript build | `npm run build` passed |

## 4. Day 31 plan — concurrent application safety (proposed)

**Goal:** Verify that two attempts to apply the same staged batch cannot create duplicate financial records or successful-import history.

Test-first sequence:
1. Inspect the current apply route/service and test setup to identify a realistic concurrency boundary.
2. Add one focused test that submits two apply attempts against the same staged batch concurrently.
3. Assert exactly one attempt succeeds (`200`) and the other is rejected (`409`), if this is the correct behavior under the existing API contract.
4. Assert the batch ends in `APPLIED`, transaction/holding effects occur exactly once, and only one successful import-history record exists.
5. If the synchronous SQLite/Fastify test environment cannot create a meaningful interleaving, document the limitation and select a deterministic service/repository-level test or a more appropriate concurrency boundary.
6. Change implementation only if the test exposes a race or missing invariant.
7. Run focused import/service/route tests, full Vitest regression, and `npm run build`; record actual results.

Do not assume that a test using `Promise.all` alone proves a race. The test must exercise a meaningful competing execution or clearly state the concurrency boundary it verifies.

## 5. Decisions and guardrails

- **No user-facing batch rejection/cancellation for now.** The schema/repository may support `REJECTED`, but do not expose the workflow without a clear UX/recovery rationale.
- Apply failures should not automatically transition a batch to `REJECTED`; rollback and retain `STAGED` when retry is appropriate.
- Exact-file SHA-256 does not solve partial overlap in modified files.
- Do not impose a heuristic unique key on transaction date/security/side/quantity/price.
- Maintain the RED → GREEN → REFACTOR discipline; one test at a time.
- GitHub remains the canonical source for code. These amendments should be kept in the Project Library and committed alongside the project documentation.
