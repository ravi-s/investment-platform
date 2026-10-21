# Personal Investment & Portfolio Platform — Master Requirements Amendment

**Amendment date:** October 21, 2026  
**Project checkpoint:** Day 25 — CSV transaction import  
**Companion tracker:** `Implementation_Tracker_Amendment_2026-10-21.md`  
**Purpose:** Record the agreed CSV-import behavior and the next duplicate-import increment. This amendment supplements the existing master requirements; it does not replace unrelated requirements.

## 1. Current CSV import scope

The first CSV import increment is a backend API. It parses and validates CSV transaction rows and delegates transaction creation to the existing transaction service so the normal transaction rules continue to apply.

The current implementation includes:
- CSV parsing and required-header validation.
- Rejection of empty or duplicate headers and malformed records.
- Validation of transaction dates, security IDs, transaction type, quantity, and price.
- Portfolio ownership authorization on the import route.
- Atomic handling of a multi-row import: if a row fails during the import, the import must not leave partial transaction or holding changes.
- Error responses that do not expose unexpected internal exception details.

The current increment does not include an upload UI, editable staging grid, broker-specific import adapters, Excel/PDF import, or background processing. These remain future capabilities unless separately prioritized.

## 2. Duplicate-import policy — agreed requirements

### 2.1 Exact-file duplicate detection

The system shall detect a previously successful import when the newly submitted CSV has exactly the same content, regardless of the filename supplied by the client.

- Use a cryptographic content hash; SHA-256 is the preferred choice.
- Hash the CSV content, not the filename or filesystem path.
- An identical file renamed before upload must still be recognized as the same content.
- The duplicate response must clearly indicate that the file was already imported.
- Rejecting a duplicate import must not create transactions or change holdings or other derived financial state.
- The import outcome must be persisted so the check works across requests and application restarts.
- A failed import must not be recorded as a successfully imported file. A corrected or retried submission must not be blocked merely because an earlier attempt failed.
- The duplicate check and successful-import record must be designed to prevent two concurrent submissions from both importing the same file.

### 2.2 Scope of duplicate identity

The exact scope of a file-hash record still needs an explicit decision: whether identical content is considered a duplicate per user, per portfolio, per importing account/source, or globally. Do not silently assume that a file imported into one portfolio must necessarily be rejected when used in another portfolio. Resolve this scope before implementing the persistence model.

The filename is metadata only; it is not part of the content identity.

### 2.3 Modified files and overlapping transactions

A changed file has a different content hash, even if most of its rows overlap a previously imported file. File-level hashing alone does not detect this case.

For the current increment:
- Do not claim that exact-file hashing solves row-level duplicate detection.
- Do not automatically reject a row merely because its date, security, transaction type, quantity, and price resemble an existing transaction.
- Do not add a unique constraint on a heuristic composite fingerprint until the domain identity rules are established.
- Treat modified-file overlap and partial-import reconciliation as separate future requirements.

## 3. Broker transaction identity and legitimate executions

Broker-provided identifiers may help identify previously imported executions, but the system must not assume every broker export provides a stable execution-level identifier.

The domain must distinguish:
- **Order ID:** identifies an order, which may be filled through multiple executions.
- **Trade/execution ID:** identifies an individual execution when supplied by the broker.
- **Internal transaction ID:** identifies the record stored by this platform.
- **Import/file ID:** identifies an import record or file submission.

Multiple legitimate executions may share the same transaction date, security, side, quantity, and price. For example, an order for four units can be filled as four executions of one unit each. The import process must preserve those legitimate executions; financial-attribute similarity alone is not sufficient proof of duplication.

A later row-level deduplication design should prefer reliable broker execution IDs when available and use review or staging when identity remains uncertain.

## 4. Future staging-preview capability

An eventual staging workflow may provide an editable grid before transactions are committed. It should support:
- Reviewing parsed rows and their validation state.
- Inline correction of transaction fields.
- Re-running validation and duplicate evaluation after edits.
- Flagging possible duplicates separately from confirmed duplicates.
- Excluding invalid or unwanted rows.
- Requiring invalid rows to be corrected or excluded before confirmation.
- Committing approved rows atomically through the existing transaction service.

This is a future capability and is not part of the current backend-only CSV-import increment.

## 5. Acceptance criteria for exact-file idempotency

The following tests must be written before implementation:

1. A valid CSV imports successfully on its first submission.
2. Re-submitting the exact same content with the same filename is rejected as a duplicate.
3. Re-submitting the exact same content with a different filename is also rejected as a duplicate.
4. A duplicate rejection leaves transaction records, holdings, and derived financial state unchanged.
5. A failed import does not create a successful-import marker; a later valid submission can be attempted.
6. Concurrent identical submissions cannot both create the transactions.
7. The behavior for identical content submitted to a different portfolio follows the explicitly decided duplicate scope.
8. A file with modified content is not misclassified as an exact-file duplicate solely because its filename matches; row-level overlap is outside this increment.

For duplicate rejection, the API should return a stable client-facing error contract and status code. Choose and test the exact response shape/status as part of the test-first increment rather than relying on incidental exception behavior.

## 6. Financial integrity invariants

Duplicate-import handling must preserve these invariants:
- No duplicate rejection may mutate transactions, holdings, or derived financial state.
- No failed import may leave partial financial writes.
- Successful imports must continue to use the standard transaction service, preserving existing validation and financial behavior, including transaction ordering, FIFO calculations, corporate-action handling, historical valuation, and performance calculations.
- File-level duplicate detection must not collapse distinct legitimate executions into one transaction.

## 7. Implementation sequence

1. Resolve the duplicate identity scope (especially cross-portfolio behavior).
2. Write acceptance tests for same-content repeat uploads, including changed filename, no side effects, failed import retry, and concurrency/idempotency.
3. Implement persistent SHA-256-based exact-file idempotency.
4. Run focused tests and the complete regression suite.
5. Track modified-file overlap, broker execution IDs, and editable staging as later increments.
