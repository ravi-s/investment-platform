# Personal Investment & Portfolio Platform — Implementation Tracker Amendment

**Amendment date:** October 21, 2026  
**Development checkpoint:** Day 25 — CSV transaction import  
**Companion requirements:** `Master_Requirements_Amendment_2026-10-21.md`  
**Purpose:** Record the verified current checkpoint and track exact-file duplicate-import protection as the next test-first increment.

## 1. Verified checkpoint

At the end of the Day 25 work described by the developer:
- The CSV transaction import API is implemented.
- `src/tests/transaction-route.test.ts`: **42/42 tests passed**.
- Full suite: **22 test files and 213 tests passed**.
- CSV parsing/validation, authorization, malformed-input handling, rollback on a failed row, and safe handling of unexpected failures were tested.
- The developer reported committing the current CSV-import changes to GitHub.

These counts are the reported checkpoint and have not been independently rerun while preparing this document.

## 2. Status tracker

| Requirement / capability | Status | Evidence / next action |
|---|---|---|
| CSV transaction import API | ✅ Implemented for current scope | Route delegates to the existing transaction service. |
| CSV header and row validation | ✅ Implemented for current scope | Tests cover duplicate/missing headers, invalid calendar date, malformed CSV, and row-specific validation errors. |
| Portfolio ownership authorization for import | ✅ Implemented for current scope | Unauthenticated request returns 401; cross-user portfolio access returns 404. |
| Atomic import / no partial writes on row failure | ✅ Implemented and tested | A SELL that exceeds available holdings returns 409; import-created transactions roll back and holdings remain unchanged. |
| Unexpected import failure response | ✅ Implemented and tested | Returns a safe 500 response without exposing internal exception details. |
| Exact-file duplicate detection | ⬜ Not implemented | Add persistent content-hash-based idempotency. |
| Same-content upload with changed filename | ⬜ Acceptance test pending | Must be rejected as duplicate; filename must not affect the content hash. |
| No financial side effects on duplicate rejection | ⬜ Acceptance test pending | Assert transaction rows, holdings, and relevant derived state remain unchanged. |
| Failed import not marked successful | ⬜ Acceptance test pending | Failed attempt must not prevent a later valid retry. |
| Concurrent identical submissions | ⬜ Design/test pending | Persistence and transaction boundaries must prevent double import. |
| Duplicate scope across portfolios | 🟡 Decision required | Explicitly decide whether content identity is scoped per user, portfolio, account/source, or globally before schema design. |
| Modified file with overlapping rows | ⬜ Future requirement | File hashing does not identify row-level overlap. Do not imply otherwise. |
| Broker execution/trade ID support | ⬜ Future domain design | Model external execution identity where available; do not assume every broker supplies it. |
| Editable staging preview / correction grid | ⬜ Deferred | Future UI/workflow; validate edited rows and re-evaluate possible duplicates before commit. |
| Excel/PDF and broker-specific adapters | ⬜ Deferred | CSV is the current first increment. |
| Background import processing | ⬜ Deferred | Not required for the current synchronous backend increment. |

## 3. Next increment: exact-file idempotency

### Step 0 — Resolve one policy decision

Before writing persistence code, decide the duplicate scope for identical CSV content submitted to a different portfolio. This affects the uniqueness key and the expected behavior.

### Step 1 — Write tests first

Add focused service/API tests for:
1. First valid submission succeeds and records the successful import.
2. Exact same CSV content and same filename is rejected on the second submission.
3. Exact same CSV content and a different filename is rejected on the second submission.
4. Duplicate rejection leaves transaction count, transaction contents, holdings, and relevant financial state unchanged.
5. A failed import does not leave a successful-import marker and does not block a later valid attempt.
6. Two concurrent identical submissions cannot both import the same content.
7. Identical content submitted to a different portfolio follows the chosen scope.
8. Different content is not rejected by the exact-file check merely because the filename is reused.

Choose a stable duplicate-error status and response body in the tests. Avoid coupling tests to an incidental error message from a low-level database exception.

### Step 2 — Implement

- Calculate SHA-256 from the received CSV content; do not include the filename in the hash.
- Persist the successful import identity and outcome in the database.
- Enforce the chosen scope with a database-level uniqueness rule or equivalent atomic mechanism.
- Coordinate the duplicate check, transaction writes, and successful-import record so concurrent submissions cannot both succeed.
- Do not mark failed imports as successful.
- Preserve the existing transaction service and all-or-nothing import behavior.

### Step 3 — Verify

- Run the focused CSV import service and route tests.
- Run the complete Vitest suite.
- Run the TypeScript/build checks used by the repository.
- Record the actual test counts and any unresolved issues in the day log before declaring the increment complete.

## 4. Domain safeguards and deferred work

- Do not use date + security + side + quantity + price as a unique key without further domain evidence. Legitimate executions can share those values.
- An order may be filled by multiple executions; an order ID is not automatically a unique execution ID.
- Broker execution IDs are useful where stable and available, but the import model must tolerate their absence.
- Modified files and partial overlap need a later row-level identity/review strategy.
- A future staging grid should allow corrections, validation refresh, duplicate re-evaluation, and row exclusion before atomic commit.

## 5. Maintenance rule

This amendment records status and next actions; it does not itself implement duplicate detection. Update the tracker only after tests and implementation provide evidence. The GitHub repository remains the canonical source of truth for code and project documentation; upload this amendment to the project Library and commit it to GitHub to preserve the checkpoint.
