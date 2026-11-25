# Personal Investment & Portfolio Platform --- Implementation Tracker Amendment

**Amendment date:** November 25, 2026\
**Project milestone:** Milestone 1 --- Zerodha Portfolio Management\
**Companion requirements:**
`Master_Requirements_Amendment_2026-11-25.md`\
**Previous checkpoint:** November 18, 2026 amendment, supplemented by
subsequent Day 37--40 work\
**Purpose:** Establish the next product milestone and its implementation
sequence while preserving earlier completion evidence and open technical
questions.

## 1. Product milestone

### Milestone 1 --- Zerodha Portfolio Management

**Goal:** A user can create a Zerodha portfolio, import historical and
recurring equity and mutual-fund transactions, review holdings and
valuation, and understand investment performance through useful
investor-facing analytics.

For this milestone: - One user-created portfolio named, for example,
**Zerodha** contains both equity and mutual-fund investments. - Equity
and mutual-fund reports may use different source formats and adapters. -
Both are normalized into the application's common transaction model. -
Asset type is a classification/reporting dimension, not a reason to
create separate portfolios. - The consolidated portfolio view is the
Zerodha portfolio itself; a separate consolidated-portfolio entity is
not required for this single-provider milestone. - Other providers
(WealthIndia, UvaWealth, WintWealth) and broker API integrations are
explicitly out of scope.

## 2. Verified project checkpoint

### Existing foundations

The project has previously implemented: - Backend and frontend
authentication, session restoration, protected routes and logout. -
Portfolio ownership authorization. - Transaction processing for
supported BUY, SELL and SPLIT activity. - Holdings and portfolio service
foundations. - Market-price service foundations. - Portfolio XIRR
implementation, which should be reused and validated rather than
duplicated. - CSV parsing/validation and staged transaction import:
stage, preview and explicit apply. - Import batches, batch items, import
history, exact-file content hashing and atomic batch application. -
Historical mutual-fund transaction adapter and
`stageHistoricalTransactions()` using the existing staging
infrastructure. - ISIN-based security identification. - Provenance
fields on staged batch items: source file, source row number, ISIN,
trade ID and order ID.

### Historical MF dataset

The prepared mutual-fund dataset: - Contains 477 transactions (396 BUY
and 81 SELL). - Covers 10 active schemes represented in the November 16,
2026 holdings statement. - Reconciles by signed units to all 10 scheme
closing balances in that statement, to three decimal places. - Retains
two confirmed distinct ICICI FoF purchases on May 5, 2026;
identical-looking transaction values must not be used alone as proof of
duplication. - Has not yet been staged and applied to the live
application portfolio.

The application import and post-import reconciliation remain incomplete.

### Test checkpoint

The latest reported backend baseline at the end of Day 40 was **302
passing tests across 28 test files**. This is a developer-reported
historical checkpoint, not a test run performed while preparing this
amendment. Re-run the suite and record fresh output before claiming a
new baseline.

Frontend test setup and a first smoke test were reported as completed in
the latest working session; verify the actual branch and package
configuration before recording detailed frontend coverage as complete.

## 3. Implementation plan

### Workstream 1 --- Domain model and existing-schema assessment

**Goal:** Confirm the smallest domain model that supports the Zerodha
milestone without a broad redesign.

Tasks: 1. Inspect the current schema, repositories, services and
frontend portfolio flow. 2. Map existing `portfolios`, `transactions`,
`holdings`, `securities`, import batches and import-history structures
to the agreed workflow. 3. Confirm that a single Zerodha portfolio can
contain equity and mutual-fund instruments. 4. Define the
provider/source metadata needed to identify Zerodha and the relevant
report type. 5. Assess whether the current schema can support this
milestone without new tables or migrations. 6. Document any gaps,
especially transaction provenance after a staged batch is applied. 7. Do
not introduce a separate consolidated-portfolio entity for this
milestone unless the assessment demonstrates a concrete need.

**Exit criteria:** A short domain-model decision and schema-gap
assessment are reviewed and agreed before schema changes.

### Workstream 2 --- Import and reconcile historical mutual-fund transactions

**Goal:** Complete the prepared 477-row historical MF import through the
application's real workflow.

Tasks: 1. Inspect the current branch implementation and tests. 2. Verify
ISIN-to-security mappings and adapter behavior. 3. Verify row-level
identity and duplicate handling, including the two distinct ICICI
purchases. 4. Stage the actual consolidated dataset. 5. Review batch
preview, errors, provenance and reconciliation. 6. Apply only after
explicit user approval. 7. Reconcile persisted units by scheme against
the November 16 holdings statement. 8. Verify that staging and failed
application do not create partial financial effects.

**Exit criteria:** Exactly the intended 477 transactions are applied
once; all 10 scheme balances reconcile; provenance is traceable; no
unintended transactions are introduced.

### Workstream 3 --- Historical equity import

**Goal:** Import supported Zerodha equity history into the same Zerodha
portfolio.

Tasks: 1. Inventory available equity reports and their date coverage. 2.
Identify report formats, transaction types, instrument identifiers and
corporate-action information. 3. Define an explicit equity adapter and
normalized mapping. 4. Test transaction identity and overlapping-file
behavior. 5. Stage, review and apply the historical equity dataset. 6.
Reconcile holdings against authoritative Zerodha reports/statements.

**Exit criteria:** Supported equity history is imported once, with
instrument mapping and resulting holdings reconciled.

### Workstream 4 --- Repeatable monthly imports

**Goal:** Support routine monthly imports for both equity and mutual
funds.

Tasks: 1. Support the relevant recurring Zerodha report formats. 2.
Detect or let the user select the report type. 3. Validate that the
report belongs to the selected Zerodha portfolio and supported source.
4. Handle overlapping reporting periods and modified/re-exported files
safely. 5. Preserve source file, source row, broker identifiers and
import batch provenance. 6. Present staged additions, duplicates,
warnings and errors for review. 7. Apply explicitly and atomically.

**Exit criteria:** Re-uploading the same report or importing overlapping
periods cannot silently create duplicate financial transactions;
legitimate distinct executions are retained.

### Workstream 5 --- Valuation and financial calculations

**Goal:** Provide reliable as-of-date holdings and performance.

Tasks: 1. Inspect existing market-price and portfolio-performance
services before extending them. 2. Persist and retrieve equity closing
prices and mutual-fund NAVs with effective dates. 3. Value holdings
using the latest valid price/NAV on or before the selected valuation
date. 4. Surface the actual price/NAV date, stale data and missing data.
5. Validate holdings, invested amount, realized and unrealized P&L, and
existing XIRR semantics. 6. Implement or complete deterministic FIFO
acquisition-lot allocation where required for realized and unrealized
cost basis. 7. Handle corporate actions and non-standard mutual-fund
transaction types explicitly.

**Exit criteria:** Calculations are covered by domain tests and
reconcile to independently verified examples. Do not claim full
performance correctness from valuation alone.

### Workstream 6 --- Investor-facing frontend

**Goal:** Make the Zerodha portfolio useful through the UI.

Initial views: - Portfolio overview and total valuation. - Holdings list
with equity and mutual-fund filters. - Platform portfolio transaction
history. - Asset allocation. - Historical portfolio value/performance
chart. - Realized and unrealized P&L. - Portfolio and instrument-level
XIRR, when calculation semantics are validated. - Import workflow with
batch preview, validation, errors and apply confirmation. - Clear
loading, empty, error, stale-price and missing-price states.

**Exit criteria:** End-to-end UI workflows are tested and backed by
stable, validated backend contracts.

## 4. Scope exclusions and deferred work

Defer until after Milestone 1: - WealthIndia, UvaWealth and WintWealth
integrations. - Broker/platform API integrations. - Multiple platform
portfolios under one consolidated portfolio. - Multiple consolidated
portfolios, family portfolios or goal-based portfolio structures. -
Splitting one broker execution across multiple portfolios. - Advanced
tax reporting and tax-lot optimization. - Complex bond valuation and
accrued-interest models. - Multi-provider reconciliation and
cross-provider duplicate identity.

Keep the design extensible, but do not implement these capabilities
prematurely.

## 5. Working rules and guardrails

-   Follow RED → GREEN → REFACTOR.
-   Inspect current code and tests before editing; the latest checked-in
    code takes precedence over older snapshots.
-   Prefer extending existing services and repositories over introducing
    parallel implementations.
-   Preserve the existing staged-import safety properties: staging has
    no financial side effects; apply is explicit and atomic.
-   File-level hashing is not transaction-level duplicate detection.
-   Never deduplicate solely on date, security, transaction type,
    quantity and price.
-   Preserve source provenance and confirmed distinct executions.
-   Keep instrument classification independent of the provider.
-   Reuse the existing portfolio XIRR implementation; do not create a
    competing engine.
-   Do not mark a capability complete until exercised and verified in
    the application.
-   Record actual test/build output and distinguish developer-reported
    historical results from fresh verification.
-   GitHub remains the canonical source for code and project
    documentation; synchronize the Project Library after committing
    amendments.

## 6. Immediate next actions

1.  Verify the current Git branch, working tree, latest commit and
    frontend test setup.
2.  Review the current domain schema and map it to the Zerodha-first
    workflow.
3.  Record the domain-model decision and schema gaps.
4.  Resume the historical MF staging work, inspect the actual 477-row
    batch preview, and apply only after explicit approval.
5.  Plan the equity import after the MF workflow is proven end to end.
