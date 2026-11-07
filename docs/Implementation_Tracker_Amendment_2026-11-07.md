# Personal Investment & Portfolio Platform — Implementation Tracker Amendment

**Amendment date:** November 7, 2026  
**Development checkpoint:** Day 31 — concurrent staged-batch application test verified; SQLite architecture decision recorded  
**Companion requirements:** `Master_Requirements_Amendment_2026-11-07.md`  
**Supersedes checkpoint:** November 6, 2026 (Day 30)  
**Purpose:** Carry forward the Day 30 tracker, record Day 31 evidence and decisions, and identify the next bounded task. Day 31 is still in progress.

## 1. Day 31 — work completed so far

### Concurrent application test

Added to `transaction-route.test.ts`:

`applies a staged batch only once when two apply requests arrive concurrently`

The test stages one BUY row and submits two apply requests for the same batch concurrently. It verifies:
- Exactly one request returns `200`.
- The competing request returns `409`.
- The batch ends in `APPLIED`.
- Exactly one transaction is persisted.
- The holding quantity reflects the transaction once.
- Exactly one successful import-history row is persisted.

### Verification results

- Focused `transaction-route.test.ts`: **52 tests passed**.
- Full Vitest regression suite: **258 tests passed across 25 test files**.
- TypeScript build: **passed**.
- Git: changes checked in by the developer.

Results are recorded from developer-reported terminal output and were not independently rerun during this document update.

### Test scope qualification

The test uses one Fastify instance, one in-memory SQLite connection, and synchronous `better-sqlite3`. It validates duplicate-apply behavior for competing requests in the current single-process architecture. It does not prove true overlapping transaction execution or cross-process/multi-instance concurrency safety. `Promise.all` alone does not establish a database race.

## 2. Import capability status

| Capability / requirement | Status | Evidence / notes |
|---|---|---|
| CSV parsing and validation | ✅ Implemented | Existing CSV validation and row-level error handling. |
| Import authorization / portfolio ownership | ✅ Implemented | Authentication and ownership checks on routes/services. |
| Import history persistence | ✅ Implemented | Migration 013 and repository/tests. |
| Exact-file content hash | ✅ Implemented in import/staging flow | SHA-256 of CSV content. |
| Duplicate check within user + portfolio | ✅ Implemented | Checks successful import history and staged batches. |
| Cross-portfolio duplicate policy | 🟡 Not formally decided | Current check is scoped to user + portfolio. |
| Transaction import batches | ✅ Implemented | Migration 014 and repository/tests. |
| Staged batch items | ✅ Implemented | Bulk persistence and ordered retrieval. |
| Stage CSV API | ✅ Implemented | Stage endpoint persists review data only. |
| Preview staged batch API | ✅ Implemented | Preview endpoint returns batch and staged items. |
| Apply staged batch API | ✅ Implemented | Apply endpoint uses the standard transaction service. |
| Batch apply authorization | ✅ Implemented and tested | Portfolio ownership and batch association enforced. |
| Apply only from `STAGED` | ✅ Implemented and tested | Reapplication returns `409`. |
| Atomic batch application | ✅ Implemented and failure-path tested | Transactions, holdings, import history, and status transition roll back together on tested failures. |
| Failed apply preserves `STAGED` | ✅ Verified | Domain and persistence failure tests. |
| Retry after recoverable apply failure | ✅ Verified | Retry succeeds after simulated status-transition failure is removed. |
| Concurrent duplicate apply — current process | ✅ Verified at route level | One `200`, one `409`; financial and import-history effects occur once. |
| Cross-process/multi-instance concurrency | ⏸ Not in initial deployment scope | Current test does not prove this; revisit if topology changes. |
| User-facing cancel/reject batch | ⏸ Deferred | No UX/recovery requirement established. |
| Editable preview/correction grid | ⏸ Deferred | Frontend/product increment. |
| Row-level duplicate/overlap detection | ⏸ Deferred | Requires transaction identity/domain design. |
| Broker execution identifiers/adapters | ⏸ Deferred | Support reliable IDs where available; no universal assumption. |
| Excel/PDF import and background processing | ⏸ Deferred | Not in current scope. |

## 3. Architecture decision — SQLite for initial deployment

**Decision:** Retain SQLite for the initial limited-user evaluation deployment; do not migrate to PostgreSQL pre-emptively.

Initial guardrails:
- One Fastify application instance on one host.
- SQLite database on persistent local disk on that host.
- No network filesystem or shared multi-host SQLite database.
- Database access only through the API.
- Evaluate WAL mode for reader/writer behavior.
- Configure an appropriate busy timeout.
- Establish backups and test restoration before relying on production data.
- No multiple application instances or worker processes sharing this SQLite database.

Reassess PostgreSQL if multiple hosts/instances, separate database hosting, material write contention, high-availability requirements, or operational needs justify it.

Do not add a generic database abstraction solely for a hypothetical migration. Existing repository boundaries are sufficient for the current stage.

## 4. Day 31 — next bounded task

**Day 31 remains IN PROGRESS.**

Next task: inspect the database initialization and connection configuration against the SQLite decision above.

Review, without changing anything initially:
1. Where the database file path is selected and whether production can use a persistent local path.
2. Whether SQLite journal mode is explicitly configured; determine whether WAL is appropriate for the intended deployment.
3. Whether a busy timeout is configured and where.
4. Whether database initialization/migrations run once in the single application process.
5. Whether backup and restore are currently documented or still deployment work.

Then report the actual code/configuration and any gaps. Make changes only where a concrete gap is found. Do not assume these settings are absent.

## 5. Guardrails

- Maintain RED → GREEN → REFACTOR.
- Do not claim cross-process concurrency safety from the current route test.
- Do not add speculative locking, worker processes, database abstraction, or PostgreSQL migration.
- Keep GitHub as the canonical source for code; commit documentation updates with the code checkpoint.
