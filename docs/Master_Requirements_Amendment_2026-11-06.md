# Personal Investment & Portfolio Platform — Master Requirements Amendment

**Amendment date:** November 6, 2026  
**Project checkpoint:** Day 30 — staged transaction import failure-path integrity verified  
**Companion tracker:** `Implementation_Tracker_Amendment_2026-11-06.md`  
**Supersedes checkpoint:** November 5, 2026 (Day 29)  
**Purpose:** Extend the November 5 amendment with the completed Day 30 failure-path verification. This amendment supplements—not replaces—the existing master requirements.

## 1. CSV import workflow — current scope

The CSV transaction import supports a staged workflow:

1. **Stage:** Parse and validate CSV rows, then persist a batch and its items without creating transactions or changing holdings.
2. **Preview:** Retrieve the staged batch and its items for review.
3. **Apply:** Explicitly apply a staged batch through the standard transaction service.
4. **Atomicity:** Transaction creation, holdings changes, import-history recording, and batch status transition to `APPLIED` occur in one database transaction. They commit together or roll back together.

### Implemented API

- `POST /api/portfolios/:portfolioId/transactions/import/stage`
  - Authenticates the user and verifies portfolio ownership.
  - Accepts `{ csv: string }`.
  - Returns `201` with batch metadata (`batchId`, `status`, `stagedCount`).

- `GET /api/portfolios/:portfolioId/transactions/import/batches/:batchId`
  - Authenticates and verifies portfolio ownership and batch association.
  - Returns batch details and staged items for preview.

- `POST /api/portfolios/:portfolioId/transactions/import/batches/:batchId/apply`
  - Authenticates and verifies portfolio and batch association.
  - Applies only a batch in `STAGED` status.
  - Returns `200` with `status: "APPLIED"` and `importedCount` on success.
  - Returns `409` for a batch that is not eligible for application (including a repeated application) and for insufficient holdings; invalid batch identifiers return `400`; authorization/resource ownership failures preserve the established `404` behavior.
  - Uses a database transaction to prevent partial financial writes.

## 2. Staging and batch persistence

Migrations and repositories introduced during Days 26–27:
- Migration `013_import_history.sql` and `ImportHistoryRepository`.
- Migration `014_create_transaction_import_batches.sql`.
- `TransactionImportBatchRepository`: create, find, and transition status from `STAGED` to `APPLIED` or `REJECTED`.
- `TransactionImportBatchItemRepository`: persist and retrieve staged rows, preserving source-row order.

A staged batch is review data, not a financial transaction. Staging must not create transactions, update holdings, or write successful-import history.

## 3. Batch lifecycle — current decision

For the current backend scope, the supported user workflow is:

`STAGED → APPLIED`

The repository/schema can represent `REJECTED`, but a user-facing rejection/cancellation workflow is **deferred**. Do not add an endpoint or service method to reject/cancel a batch at this time.

Do not automatically mark a batch rejected when application fails. An apply failure should roll back and, where the failure is retryable/correctable, leave the batch `STAGED`.

## 4. Exact-file duplicate protection — status clarification

Content identity is based on CSV content, not filename; a repeated exact-content submission must not create duplicate financial records; failed attempts must not be recorded as successful; concurrency must not allow duplicate application.

The current staging service computes a SHA-256 content hash and checks import history and existing staged batches. The observed check is scoped by **user and portfolio**. Therefore:
- Same content is detected against prior imports or staged batches within that user/portfolio scope.
- A cross-portfolio duplicate policy has not been separately ratified as a product requirement; retain this as an explicit domain decision before broadening the scope.
- Hashing does not detect modified files with overlapping rows.
- Do not deduplicate transactions using only date, security, side, quantity, and price; legitimate executions can share those attributes.

## 5. Financial integrity invariants

These requirements remain mandatory:
- Staging and preview do not mutate financial state.
- Applying a batch uses the standard transaction service and its validation.
- A batch can be applied only while it is `STAGED`.
- Repeated or concurrent application must not create duplicate transactions.
- A failed apply must not leave partial transactions, holdings, import history, or an `APPLIED` status.
- Transactions, holdings, import history, and batch status changes must commit or roll back together.
- A retryable failed apply leaves the batch `STAGED` and its staged items available for retry.
- Ownership and batch association are enforced at service/API boundaries.
- Preserve legitimate distinct executions; heuristic row similarity is not proof of duplication.

## 6. Day 30 — failure-path and atomicity verification (COMPLETE)

Day 30 strengthened service-level and API-level evidence for atomic staged-batch application.

Service-level coverage in the updated `transaction-import.test.ts` includes:
- Insufficient holdings during apply: financial writes and import history roll back; batch remains `STAGED`; staged items remain.
- Import-history persistence failure: the transaction/holding changes and batch application are rolled back.
- Batch status-transition failure: transaction, holding, and import-history writes roll back; batch remains `STAGED`.
- Successful retry: after a simulated status-transition failure, the same staged batch can be applied successfully.

API-level coverage in the updated `transaction-route.test.ts` includes:
- Applying a staged batch with insufficient holdings returns `409` with `Insufficient holding`.
- No transactions, holdings, or import-history rows persist.
- The batch remains `STAGED`, `applied_at` remains null, and staged items remain available.

Reported verification results for Day 30:
- Focused `transaction-route.test.ts`: **51 tests passed**.
- Full Vitest regression suite: **257 tests passed across 25 test files**.
- `npm run build` (`tsc`): **passed**.
- Git status reported branch `main` up to date with `origin/main`.

These are developer-reported terminal results; they were not independently rerun during this document update.

## 7. Deferred capabilities

- User-facing cancel/discard/reject batch workflow.
- Editable staging grid and row exclusion/correction.
- Modified-file overlap and row-level reconciliation.
- Broker-specific adapters and reliable execution-ID mapping.
- Excel/PDF imports.
- Background import processing.
- Import lifecycle audit enhancements, including optional cancellation reasons.

These remain future work and should be prioritized based on product need rather than added preemptively.

## 8. Next development increment — Day 31 (PROPOSED)

Focus: **concurrent application safety for a single staged batch**.

The master requirement already states that concurrency must not allow duplicate application. Day 31 should verify that invariant before expanding the import feature set.

Test-first sequence:
1. Inspect the current apply route/service and test setup to identify a realistic way to issue two apply attempts against the same staged batch.
2. Add one focused concurrency test: arrange one staged batch, submit two apply attempts concurrently, and assert that exactly one attempt succeeds while the other is rejected as no longer `STAGED` (expected API outcomes: one `200`, one `409`).
3. Assert that the batch is `APPLIED` once, transaction and holding effects are present exactly once, and only one successful import-history record exists.
4. Run the focused test and inspect the actual execution/transaction semantics. If the test reveals a race, fix the underlying atomicity/serialization issue; do not add speculative locking or refactor without evidence.
5. Run focused import/service/route tests, full Vitest regression, and TypeScript/build checks. Record actual results.

If the current synchronous SQLite/Fastify execution model cannot produce a meaningful concurrent interleaving in the test environment, document that limitation and choose a deterministic service/repository-level race test or a more appropriate concurrency boundary rather than claiming concurrency has been proven.

## 9. Decisions and guardrails

- **No user-facing batch rejection/cancellation for now.** The schema/repository may support `REJECTED`, but do not expose the workflow without a clear UX/recovery rationale.
- Apply failures should not automatically transition a batch to `REJECTED`; rollback and retain `STAGED` when retry is appropriate.
- Exact-file SHA-256 does not solve partial overlap in modified files.
- Do not impose a heuristic unique key on transaction date/security/side/quantity/price.
- Maintain the RED → GREEN → REFACTOR discipline; one test at a time.
- GitHub remains the canonical source for code. Keep the Library amendments synchronized with the project documentation and commit the documentation alongside the code checkpoint.
