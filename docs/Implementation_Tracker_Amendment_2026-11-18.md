# Personal Investment & Portfolio Platform --- Implementation Tracker Amendment

**Amendment date:** November 18, 2026\
**Development checkpoint:** Day 36 --- transaction consolidation and
holdings reconciliation completed; application import not yet started\
**Companion requirements:**
`Master_Requirements_Amendment_2026-11-18.md`\
**Supersedes checkpoint:** November 13, 2026 (Day 33)\
**Purpose:** Carry forward the existing tracker, record Day 34
authentication completion and Day 36 data-preparation results, and
establish the ordered implementation plan.

## 1. Verified project status

### Day 34 --- frontend authentication state: COMPLETE

Completed and verified: - Application-level authentication
state/provider. - Session restoration on application startup through
`/api/auth/me`. - Login updates shared authentication state. - Protected
frontend routes. - Frontend logout integration. - Logout verification:
backend session revocation, frontend state clearing, redirect to Login,
and subsequent `/api/auth/me` returning HTTP 401. - The user confirmed
the full UI workflows showed no regressions and the work was baselined
in GitHub.

The November 13 tracker is older than this completion and must no longer
describe these items as outstanding.

### Day 36 --- mutual-fund data preparation: COMPLETE

-   10 active mutual-fund schemes from the November 16, 2026 holdings
    statement.
-   477 transactions consolidated from 2018 through November 11, 2026.
-   2021--2025 filtered history: 312 of 312 selected transactions
    matched against the original annual Kite exports.
-   2026 export: 134 transactions for the 10 active schemes selected
    from 156 rows across 12 ISINs.
-   22 transactions outside the active holdings scope excluded from the
    active working dataset and retained separately as source evidence.
-   All 10 scheme net-unit balances reconcile to the November 16
    holdings statement to three decimal places.
-   Edelweiss dedicated exports were diagnostic only.
    `2026-tilldate.csv` is the selected 2026 source; do not append the
    separate Edelweiss exports.
-   Two identical-looking ICICI FoF purchases on May 5, 2026 were
    confirmed by the user as distinct broker transactions; retain both.

The user cross-verified the preliminary FIFO allocation results. The
external reference calculation classified 477 transactions, produced 146
redemption-to-lot allocation rows and 323 remaining lots, with no
unmatched redemption units. This is reference evidence only; FIFO lot
construction is **not yet implemented in the application**.

### Boundary and test baseline

The consolidated CSV and reconciliation files have **not yet been
imported into the application**. Do not mark historical transaction
import complete until the application staging/apply workflow is
exercised and post-import holdings are reconciled.

The latest previously documented backend regression baseline was 282
tests across 27 files. This is not a new Day 36 test run. No new backend
test count is recorded here.

## 2. Capability status

  ----------------------------------------------------------------------------
  Capability              Status                  Evidence / next action
  ----------------------- ----------------------- ----------------------------
  Backend authentication  ✅ Complete             Registration/login/session
  and session lifecycle                           lookup/logout verified in
                                                  prior checkpoint.

  Frontend application    ✅ Complete             Day 34 provider and shared
  auth state                                      auth state implemented.

  Startup session         ✅ Complete             `/api/auth/me` restores
  restoration                                     session.

  Protected frontend      ✅ Complete             Backend authorization
  routes                                          remains authoritative.

  Frontend logout         ✅ Complete             API revocation, state
                                                  clearing, redirect and 401
                                                  verified.

  CSV parsing and staged  ✅ Implemented          Stage, preview and apply
  transaction import                              workflow with authorization
                                                  and atomicity tests.

  Historical 477-row      ✅ Prepared/reconciled  10 active schemes; not yet
  active-scheme dataset   externally              imported into application.

  Historical import into  ⬜ NEXT                 Inspect importer mapping and
  application                                     duplicate semantics; stage,
                                                  review, apply, reconcile.

  Row identity without    🟡 Design/test required Do not rely solely on file
  broker trade ID                                 hash or identical field
                                                  values; preserve confirmed
                                                  distinct executions.

  FIFO acquisition-lot    ⬜ Not implemented      Use cross-verified external
  engine in application                           allocations as reference
                                                  fixtures.

  Realized P&L in         ⬜ Not implemented /    Build on FIFO allocations;
  application             verify existing scope   initially before charges and
                                                  taxes.

  Mutual-fund NAV         ⬜ Not implemented      MFapi.in candidate; AMFI
  provider adapter                                reference source. Inspect
                                                  existing market-data
                                                  capability first.

  Persisted historical    ⬜ Not implemented /    Store NAV effective date
  NAV and synchronization schema decision pending separately from
                                                  fetched/available timestamp.

  Market value and        ⬜ Not implemented /    Use persisted NAVs and
  unrealized P&L          verify existing scope   remaining acquisition lots.

  XIRR                    ✅ Existing             Already part of portfolio
                          implementation          service; reuse and validate,
                                                  do not duplicate.

  Portfolio/scheme        ⬜ Future               Build after backend
  performance UI                                  calculations and valuation
                                                  semantics are stable.

  Password policy         🟡 Planned, non-urgent  Retain requirements from
                                                  November 13 amendment.

  Password change/reset   ⏸ Deferred / assess     Preserve prior security
  and login rate limiting separately              requirements.
  ----------------------------------------------------------------------------

## 3. Ordered implementation plan

Follow this sequence. Do not start NAV dashboards or performance UI
before transaction import and underlying domain calculations are
dependable.

### Milestone 1 --- Import validated historical transactions into the application

**Goal:** Import the 477 active-scheme transactions through the existing
staged CSV workflow.

1.  Inspect the current import parser, schema validation, transaction
    service, security/ISIN mapping, import-history repository, and
    staged-batch workflow.
2.  Compare consolidated CSV columns with the accepted import contract.
    Prefer a small explicit adapter/normalization step over weakening
    validation globally.
3.  Determine how the importer handles missing broker trade IDs and
    overlapping/modified files.
4.  Define and test row-level identity behavior. Preserve both
    user-confirmed identical-looking ICICI transactions; do not
    deduplicate merely because date, ISIN, type, quantity and price
    match.
5.  Preserve source filename and source row number in auditable import
    provenance.
6.  Stage the 477-row active dataset and inspect preview, row errors,
    scheme mapping and duplicate warnings.
7.  Apply only after preview is correct.
8.  Verify persisted counts by scheme, resulting units, import history,
    and reconciliation against the November 16 holdings statement.
9.  Run focused tests, full regression tests and build; record actual
    results without carrying forward stale counts.

**Acceptance criteria** - Exactly the intended 477 active-scheme
transactions are persisted once. - No inactive-scheme transactions are
imported into the active portfolio. - Both confirmed distinct ICICI rows
are retained. - No duplicate Edelweiss records are introduced. - Source
provenance remains traceable. - Imported unit balances reconcile to all
10 November 16 closing holdings. - Staging and failed application have
no partial financial side effects.

### Milestone 2 --- FIFO acquisition lots and realized P&L in the backend

**Goal:** Implement deterministic, auditable FIFO logic using persisted
application transactions.

1.  Inspect existing transaction and performance services before adding
    code.
2.  Add domain tests using the externally cross-verified FIFO allocation
    dataset as reference fixtures.
3.  Build acquisition lots from BUY transactions.
4.  Allocate SELL/redemption quantities against oldest eligible lots.
5.  Persist or deterministically derive lot balances and allocation
    records, choosing the simplest auditable approach.
6.  Handle insufficient lots, same-day ordering, decimal precision, and
    repeatable recalculation.
7.  Explicitly classify switch/STP legs and other non-ordinary
    transaction types before treating them as BUY/SELL.
8.  Calculate realized P&L before charges/taxes; keep tax classification
    separate.

**Acceptance criteria** - Deterministic allocations reproduce verified
reference results for the supported ordinary BUY/SELL dataset. - No
redemption consumes more units than available. - Lot balances and
holdings quantities agree. - Recalculation does not create duplicate
allocations or mutate source transactions. - Tests cover partial/full
lot consumption, multiple lots, same-day ordering, insufficient units
and repeated calculation.

### Milestone 3 --- Mutual-fund NAV integration

**Goal:** Persist daily NAV history for active mutual-fund schemes.

1.  Inspect existing `market_prices` and market-data schema/services
    before deciding whether to extend them or create a distinct NAV
    table.
2.  Evaluate MFapi.in as the initial provider candidate and AMFI as the
    independent reference source.
3.  Define a provider-neutral `NavProvider` interface and implement the
    first adapter.
4.  Map provider scheme identifiers to internal securities using stable
    identifiers such as ISIN wherever available; do not rely only on
    display names.
5.  Store NAV effective date separately from fetched/available
    timestamp.
6.  Implement idempotent historical and incremental synchronization with
    validation, failure reporting and safe retries.
7.  Test missing dates, holidays, duplicate dates, malformed values,
    provider failures and scheme mapping.
8.  Avoid external API calls during ordinary portfolio calculations; use
    persisted NAV records.

**Acceptance criteria** - Historical NAVs can be fetched and persisted
for the 10 active schemes. - Repeated synchronization does not create
duplicate `(scheme, NAV effective date)` records. - NAV effective date
is not confused with retrieval date. - Provider failures do not corrupt
transactions, holdings or existing NAV history. - Provider adapter can
be replaced without changing portfolio domain calculations.

### Milestone 4 --- Valuation and portfolio performance

**Goal:** Extend existing portfolio calculations using imported
transactions, FIFO lots and persisted NAVs.

1.  Calculate holdings and market value as of a requested valuation date
    using the NAV effective for that date.
2.  Calculate remaining FIFO acquisition cost and unrealized P&L.
3.  Integrate realized P&L from FIFO allocations.
4.  Reuse the existing XIRR implementation in the portfolio service;
    inspect current cash-flow semantics and tests before extending it.
5.  Add scheme-level and portfolio-level performance responses.
6.  Identify valuation date, latest available NAV date, stale/missing
    NAV conditions and calculation assumptions.

**Acceptance criteria** - Unit balances agree with transaction-derived
holdings. - Market value equals units multiplied by applicable NAV,
subject to documented rounding. - Realized and unrealized P&L are
independently testable and combine consistently. - Existing XIRR
behavior is preserved and validated; no duplicate XIRR engine is
introduced. - Missing/stale NAV data is surfaced explicitly.

### Milestone 5 --- React portfolio and performance views

**Goal:** Present stable backend results in the frontend.

-   Current portfolio summary and valuation date.
-   Scheme-level holdings, units, NAV, market value and P&L.
-   Realized/unrealized P&L breakdown.
-   Portfolio and scheme XIRR using the existing backend calculation.
-   Loading, empty, stale-data and provider-error states.

Start this only after the backend contracts and calculations are tested.

## 4. Working rules and guardrails

-   Follow RED → GREEN → REFACTOR.
-   Inspect current files and tests before editing; latest checked-in
    code takes precedence over assumptions in earlier notes.
-   Reuse existing services, repositories, schemas and endpoints where
    they meet the requirement.
-   Do not duplicate the existing portfolio-service XIRR implementation.
-   Keep active portfolio membership separate from historical
    transaction existence.
-   Preserve broker source evidence and user-confirmed distinct
    transactions.
-   Do not claim import, NAV synchronization or calculations are
    complete until exercised and verified in the application.
-   Keep GitHub as canonical code source and commit tracker/requirements
    amendments with the relevant project checkpoint.
