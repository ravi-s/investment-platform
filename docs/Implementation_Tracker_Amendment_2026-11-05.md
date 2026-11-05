# Personal Investment & Portfolio Platform — Implementation Tracker Amendment

**Amendment date:** November 5, 2026  
**Development checkpoint:** Day 29 — CSV transaction staging workflow complete  
**Companion requirements:** `Master_Requirements_Amendment_2026-11-05.md`  
**Supersedes checkpoint:** October 21, 2026 (Day 25)  
**Purpose:** Carry forward the October 21 tracker with verified Days 26–29 outcomes and establish the Day 30 test-first plan.

## 1. Verified checkpoint — Day 29

### Day 26 — Import history
- Migration `013_import_history.sql` applied.
- `ImportHistoryRepository` implemented and tested.
- CSV import tests extended to verify import-history persistence and duplicate protection.
- Reported regression checkpoint: **223 passing tests**.

### Day 27 — Transaction import batches and items
- Migration `014_create_transaction_import_batches.sql` applied.
- `TransactionImportBatchRepository` implemented: create, find, and status transition (`STAGED` → `APPLIED` / `REJECTED`).
- `TransactionImportBatchItemRepository` implemented: atomic `createMany` and `findByBatchId`, preserving source-row order.
- Repository tests passed.
- Staging tests verify no transaction/holding mutation.
- Reported regression checkpoint: **223 passing tests**.

### Day 28 — Staging workflow
- Implemented service-level staging and application workflow.
- Added test coverage for staging valid CSV without financial side effects and applying a staged batch.
- Reported regression checkpoint before Day 29: **242 passing tests**.

### Day 29 — API endpoints and authorization
- Implemented staging endpoint, staged-batch preview endpoint, and apply endpoint.
- Verified ownership and batch association checks.
- Verified successful application, repeated-apply rejection (`409`), invalid batch ID handling (`400`), and cross-user access protection (`404`).
- Focused `transaction-route.test.ts`: **50 tests passed**.
- Full regression suite: **253 tests passed**.
- Day 29 is considered **COMPLETE**.

Counts above are recorded from the developer-reported terminal test outputs; they have not been independently rerun in this document update.

## 2. Status tracker

| Capability / requirement | Status | Evidence / notes |
|---|---|---|
| CSV parsing and validation | ✅ Implemented | Existing CSV validation and row-level error handling. |
| Import authorization / portfolio ownership | ✅ Implemented | Authentication and ownership checks on routes/services. |
| Import history persistence | ✅ Implemented | Migration 013 and repository/tests. |
| Exact-file content hash | ✅ Implemented in import/staging flow | SHA-256 of CSV content; filename is not the identity. |
| Duplicate check within user + portfolio | ✅ Implemented | Checks successful import history and staged batches. |
| Cross-portfolio duplicate policy | 🟡 Not formally decided | Current check is scoped to user + portfolio; decide explicitly before changing scope. |
| Transaction import batches | ✅ Implemented | Migration 014 and repository tests. |
| Staged batch items | ✅ Implemented | Bulk persistence and ordered retrieval. |
| Stage CSV API | ✅ Implemented | `POST .../transactions/import/stage`; returns batch metadata. |
| Preview staged batch API | ✅ Implemented | `GET .../transactions/import/batches/:batchId`; returns batch and items. |
| Apply staged batch API | ✅ Implemented | `POST .../transactions/import/batches/:batchId/apply`. |
| Batch apply authorization | ✅ Implemented and tested | Portfolio ownership and batch association enforced. |
| Apply only from `STAGED` | ✅ Implemented and tested | Reapplication returns `409`; no duplicate transaction creation. |
| Atomic batch application | ✅ Implemented; failure-path verification next | Transactions, holdings, import history, and status transition share a DB transaction. Day 30 strengthens tests. |
| Failed apply preserves `STAGED` status | 🟡 Design expectation; Day 30 test pending | Verify rollback and retry behavior. |
| User-facing cancel/reject batch | ⏸ Deferred by decision | Do not implement until workflow need is established. |
| Editable preview/correction grid | ⏸ Deferred | Frontend/product increment. |
| Row-level duplicate/overlap detection | ⏸ Deferred | Requires transaction identity/domain design. |
| Broker execution identifiers/adapters | ⏸ Deferred | Support reliable IDs where available; no universal assumption. |
| Excel/PDF import and background processing | ⏸ Deferred | Not in current scope. |

## 3. Day 30 plan — failure-path integrity

**Goal:** Prove that an unsuccessful staged-batch application cannot partially mutate financial state and that retry remains possible.

### Step 1 — One test (RED)
In the existing `transaction-import.test.ts` setup, add a single focused service test:
- Stage a valid CSV batch.
- Arrange for applying one staged transaction to fail (use a domain-valid failure such as a SELL that exceeds available holdings, if supported by current fixture/service behavior).
- Assert the apply throws.
- Assert transaction rows and holdings are unchanged from pre-apply state.
- Assert batch status remains `STAGED`.
- Assert no successful import-history row was committed.

Run only this test and share the result before proceeding.

### Step 2 — Implementation (only if RED exposes a gap)
Inspect `applyStagedBatch()` and the existing transaction service. The implementation already wraps transaction creation, import-history persistence, and status transition in a database transaction. Do not refactor working code without evidence.

### Step 3 — Retry / persistence failure tests
After the first test is GREEN, add one test at a time:
- Retry a still-`STAGED` batch after a recoverable failure and verify successful application.
- Simulate import-history persistence failure and verify complete rollback.
- If practical, simulate status-transition failure and verify the same rollback guarantees.

### Step 4 — Verification
- Focused `transaction-import.test.ts`.
- Focused `transaction-route.test.ts`.
- Full Vitest regression suite.
- Existing TypeScript/build checks.
- Record actual counts and any unresolved findings.

## 4. Decisions and guardrails

- **No user-facing batch rejection/cancellation for now.** The schema/repository may support `REJECTED`, but do not expose the workflow without a clear UX/recovery rationale.
- Apply failures should not automatically transition a batch to `REJECTED`; rollback and retain `STAGED` when retry is appropriate.
- Exact-file SHA-256 does not solve partial overlap in modified files.
- Do not impose a heuristic unique key on transaction date/security/side/quantity/price.
- Maintain the RED → GREEN → REFACTOR discipline; one test at a time.
- GitHub remains the canonical source for code. These amendments should be uploaded to the project Library and committed alongside the project documentation.
