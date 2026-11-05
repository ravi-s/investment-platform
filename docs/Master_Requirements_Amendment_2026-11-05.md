# Personal Investment & Portfolio Platform — Master Requirements Amendment

**Amendment date:** November 5, 2026  
**Project checkpoint:** Day 29 — CSV transaction staging, preview, and application  
**Companion tracker:** `Implementation_Tracker_Amendment_2026-11-05.md`  
**Supersedes checkpoint:** October 21, 2026 (Day 25)  
**Purpose:** Extend the October 21 amendment with verified progress from Days 26–29 and record the next development increment. This amendment supplements—not replaces—the existing master requirements.

## 1. CSV import workflow — current scope

The CSV transaction import now supports a staged workflow:

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
  - Returns `409` for a batch that is not eligible for application (including a repeated application); invalid batch identifiers return `400`; authorization/resource ownership failures preserve the established `404` behavior.
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

The repository/schema can represent `REJECTED`, but a user-facing rejection/cancellation workflow is **deferred**. We will not add an endpoint or service method to reject/cancel a batch at this time.

Rationale:
- A user can make an incorrect decision; unnecessary terminal actions should not be exposed before the UX and recovery model are clear.
- A batch may be valid even if a user chooses not to proceed.
- Financial correctness and controlled application take priority over convenience.
- Revisit cancellation/discard when the frontend workflow and user needs are clearer.

Do not automatically mark a batch rejected when application fails. An apply failure should roll back and, where the failure is retryable/correctable, leave the batch `STAGED`.

## 4. Exact-file duplicate protection — status clarification

The October 21 requirement remains: content identity is based on CSV content, not filename; a repeated exact-content submission must not create duplicate financial records; failed attempts must not be recorded as successful; concurrency must not allow duplicate application.

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
- Repeated application must not create duplicate transactions.
- A failed apply must not leave partial transactions, holdings, import history, or an `APPLIED` status.
- Transactions, holdings, import history, and batch status changes must commit or roll back together.
- Ownership and batch association are enforced at service/API boundaries.
- Preserve legitimate distinct executions; heuristic row similarity is not proof of duplication.

## 6. Deferred capabilities

- User-facing cancel/discard/reject batch workflow.
- Editable staging grid and row exclusion/correction.
- Modified-file overlap and row-level reconciliation.
- Broker-specific adapters and reliable execution-ID mapping.
- Excel/PDF imports.
- Background import processing.
- Import lifecycle audit enhancements, including optional cancellation reasons.

These remain future work and should be prioritized based on product need rather than added preemptively.

## 7. Next development increment — Day 30

Focus: **failure-path and atomicity verification for staged batch application**.

Test-first sequence:
1. Write one focused test where applying a staged batch fails due to a transaction/holding validation error; assert that no partial transactions or holding changes persist and the batch remains `STAGED`.
2. Run the focused test and observe RED.
3. Inspect the existing transaction/service behavior and add or adjust implementation only if the test reveals a gap.
4. Add a test for a failure while import-history persistence or batch-status transition is attempted, if the current test setup can simulate it reliably.
5. Verify retry semantics after a failure: a valid retry can apply the still-`STAGED` batch.
6. Run focused import/service/route tests, then the full regression suite and TypeScript/build checks.
7. Record actual test counts and close Day 30 only after evidence.

Do not start with multiple tests at once; follow the established RED → GREEN → REFACTOR workflow one test at a time.
