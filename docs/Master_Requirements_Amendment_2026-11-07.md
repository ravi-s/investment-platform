# Personal Investment & Portfolio Platform — Master Requirements Amendment

**Amendment date:** November 7, 2026  
**Project checkpoint:** Day 31 — concurrent staged-batch application test added; verification passed  
**Companion tracker:** `Implementation_Tracker_Amendment_2026-11-07.md`  
**Supersedes checkpoint:** November 6, 2026 (Day 30)  
**Purpose:** Supplement the existing master requirements with Day 31 concurrency evidence and the agreed initial SQLite deployment architecture. This amendment does not replace the master requirements or earlier amendments.

## 1. Staged batch application — concurrency invariant

The existing financial-integrity requirement remains:

> Repeated or competing attempts to apply the same staged batch must not create duplicate transactions, holding effects, or successful-import history.

The apply operation continues to require all of the following to succeed atomically:
- Transaction creation through the standard transaction service.
- Resulting holding changes.
- Successful import-history persistence.
- Transition of the batch from `STAGED` to `APPLIED`.

A batch that is no longer `STAGED` must not be applied again. The API contract for an ineligible/repeated apply remains HTTP `409`.

## 2. Day 31 — concurrent apply test (verification recorded)

A route-level test was added to `transaction-route.test.ts`:

`applies a staged batch only once when two apply requests arrive concurrently`

The test:
1. Stages a CSV batch containing one BUY transaction.
2. Sends two apply requests for the same batch using `Promise.all`.
3. Expects one `200` response and one `409` response.
4. Verifies the batch is `APPLIED`.
5. Verifies exactly one transaction was created, the holding quantity reflects that transaction once, and exactly one successful import-history row exists.

**Reported verification results:**
- Focused `transaction-route.test.ts`: **52 tests passed**.
- Full Vitest regression suite: **258 tests passed across 25 test files**.
- TypeScript build: **passed**.
- Git: changes checked in by the developer.

These are developer-reported terminal results; they were not independently rerun during this document update.

### Concurrency test boundary and limitation

The test runs through one Fastify instance, one in-memory SQLite database connection, and the current synchronous `better-sqlite3` execution model. It verifies that two competing API requests in the current single-process application do not apply the same staged batch twice.

It does **not** establish a true overlapping database-transaction race, nor does it prove safety across multiple Node.js processes, multiple application instances, or multiple database connections. `Promise.all` by itself is not evidence of such interleaving.

The implementation's synchronous database transaction and conditional `STAGED`-to-`APPLIED` transition are important safeguards. Cross-process concurrency is not part of the initial deployment topology agreed below. Revisit it if the deployment topology changes.

## 3. Initial database and deployment architecture decision

### Decision

Retain SQLite for the initial limited-user evaluation deployment. Do not migrate to PostgreSQL pre-emptively.

The initial operating assumptions and guardrails are:
- Run one Fastify application instance on one host.
- Keep the SQLite database on persistent local disk on that same host.
- Do not place the SQLite database on a network filesystem or use it as a shared database across multiple machines.
- Keep database access behind the application API; clients do not access the database file directly.
- Evaluate and configure WAL mode where appropriate for concurrent readers and a single writer.
- Configure a suitable SQLite busy timeout rather than relying on immediate lock failures.
- Establish backups and test restoration before relying on the deployment for important data.
- Do not introduce worker processes or multiple application instances while relying on this initial SQLite topology.

SQLite remains an intentional initial production choice for the expected limited workload, not a claim that it is suitable for every scale or topology.

### Revisit PostgreSQL when

Reassess the database choice when one or more of these conditions become real requirements:
- Multiple application instances or hosts are needed.
- The application and database must run on separate machines.
- Write contention or lock waits materially affect user experience.
- High availability, managed database operations, or stronger operational separation is required.
- The deployment requires a shared database for multiple application nodes.

Do not introduce a generic database abstraction solely to anticipate this migration. Continue using the existing repository boundaries and migrate when operational requirements justify it.

## 4. Day 31 status

The concurrent apply test and its current-topology verification are complete. Day 31 remains **IN PROGRESS** while the database bootstrap/configuration is reviewed against the agreed SQLite operating assumptions. No WAL, timeout, filesystem, or deployment changes should be made until the current implementation is inspected and a concrete gap is identified.

## 5. Continuing guardrails

- Preserve the RED → GREEN → REFACTOR workflow.
- Make one focused change at a time.
- Do not claim cross-process concurrency guarantees from the current test.
- Do not add speculative locks, workers, abstractions, or database migration work.
- Keep GitHub as the canonical source for code and keep project documentation synchronized with checked-in implementation.
