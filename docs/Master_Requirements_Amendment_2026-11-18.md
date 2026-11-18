# Personal Investment & Portfolio Platform --- Master Requirements Amendment

**Amendment date:** November 18, 2026\
**Project checkpoint:** Day 36 --- active mutual-fund transaction
history consolidated and reconciled; application import is next\
**Companion tracker:** `Implementation_Tracker_Amendment_2026-11-18.md`\
**Supersedes checkpoint:** November 13, 2026 (Day 33)\
**Purpose:** Supplement the existing master requirements with the Day 34
authentication completion, Day 36 data-preparation baseline, and the
next implementation requirements. This amendment does not replace the
master requirements or earlier amendments.

## 1. Project checkpoint

Day 34 frontend authentication work is complete: application-level
authentication state, startup session restoration, login state updates,
protected frontend routes, and logout integration were implemented and
verified. Logout verification covered backend session revocation,
frontend state clearing, redirect to Login, and a subsequent
`/api/auth/me` response of HTTP 401.

The latest previously documented backend regression baseline was 282
tests across 27 files. This is historical evidence, not a test run
performed during Day 36 data preparation. No new backend test count is
claimed here.

## 2. Active portfolio membership and historical transactions

The application shall distinguish current portfolio membership from
historical transaction existence.

-   A scheme may have historical transactions but no longer belong to
    the active portfolio.
-   Current portfolio valuation and active-portfolio performance include
    only schemes currently held or explicitly included in the portfolio.
-   Historical transactions for inactive schemes remain historical
    records where imported, but do not contribute to current
    active-portfolio valuation.
-   The November 16, 2026 holdings statement contains 10 active
    mutual-fund schemes.
-   The 22 transactions for schemes outside that active holdings scope
    were excluded from the active working dataset and retained
    separately as source evidence.

This is a membership rule, not a reason to delete historical financial
records.

### 2.1 Validated reference dataset

  Period / source                                   Active-scheme transactions
  ----------------------------------------------- ----------------------------
  2018                                                                       4
  2019                                                                      14
  2020                                                                      13
  2021--2025 filtered history                                              312
  2026 calendar-year export through November 11                            134
  **Total**                                                            **477**

The complete 2026 export contained 156 transactions across 12 ISINs. The
134 transactions for the 10 schemes in the November 16 holdings
statement form the active working dataset; 22 transactions outside that
scope are excluded.

The 312-row 2021--2025 filtered dataset was compared with the five
original annual Kite exports. All 312 selected transactions matched the
originals on transaction identity and available fields; no missing
selected transactions, duplicate trade IDs, or field mismatches were
identified.

The 477-row consolidated active-scheme dataset reconciles by signed
units to all 10 November 16, 2026 closing holdings, to three decimal
places.

These files are reference artifacts and have **not yet been imported
into the application**.

### 2.2 Historical import integrity

The historical import shall:

-   Preserve transaction date, ISIN, transaction type, quantity,
    price/NAV, broker identifiers where available, and source
    provenance.
-   Preserve source filename and source row number in auditable import
    metadata or an import-to-transaction association.
-   Use ISIN as the primary external scheme identifier and map it to
    internal security identity.
-   Support records without broker trade IDs.
-   Not treat identical values as proof of duplicate identity. Two
    identical-looking ICICI Prudential Income Plus Arbitrage Omni FoF
    purchases dated May 5, 2026 (71.157 units at 70.2634) were confirmed
    as two distinct broker transactions; retain both.
-   Use `2026-tilldate.csv` as the selected 2026 source. The separate
    Edelweiss exports were diagnostic and must not be appended to it.
-   Use the existing stage → preview → apply workflow. Staging must not
    create financial transactions or alter holdings; applying must use
    the existing atomic transaction workflow.
-   Reconcile imported quantities against the November 16 holdings
    statement before declaring import complete.

The row-level duplicate identity policy for records without broker trade
IDs must be designed and tested. File-level content hashing alone does
not detect overlapping rows in a modified file.

## 3. Mutual-fund NAV data

The application shall persist its own mutual-fund NAV history for
valuation and performance. Calculations must not depend on a live
external API request when a dashboard is rendered.

Each NAV record shall distinguish: - Internal scheme/security
identity. - NAV effective date (the date to which the NAV applies). -
NAV value. - Provider/source. - Retrieval timestamp and, where exposed,
publication/availability timestamp.

A NAV retrieved or published on T+1 may apply to effective date T. Do
not conflate the effective date with retrieval date or hardcode a
universal T+1 rule; timing may vary by scheme type, provider, business
day, and holidays.

### Provider strategy

-   MFapi.in is the initial candidate due to its REST interface and
    historical NAV access.
-   AMFI is the official reference source for validation and possible
    fallback/data-quality checks.
-   Provider selection remains subject to evaluating scheme mapping,
    historical coverage, reliability, rate limits, and terms.
-   Isolate provider response formats behind a `NavProvider` interface.
-   Synchronization shall be idempotent, validate scheme/date/value,
    record outcomes, and tolerate provider outages without corrupting
    investment records.

## 4. Portfolio valuation and performance

The backend already contains XIRR calculation in the portfolio service.
Reuse and extend it; do not introduce a competing XIRR implementation.

Develop the capability incrementally: 1. Build and test FIFO acquisition
lots from persisted transactions. 2. Allocate redemptions against
eligible lots and calculate realized gain/loss before charges. 3. Retain
remaining lots and cost basis. 4. Retrieve and persist NAV history
independently of request-time calculations. 5. Calculate market value
and unrealized gain/loss using effective-date NAV and remaining units.
6. Extend the existing portfolio service to expose realized/unrealized
P&L and validate/reuse its XIRR. 7. Support scheme-level and
portfolio-level reporting with explicit valuation dates and assumptions.

External FIFO results are reference data for tests and reconciliation,
not a substitute for application implementation.

FIFO must be deterministic and auditable, including same-day ordering
where execution time or another reliable sequence is available.
Switch/STP legs, dividends/reinvestments, splits, reversals, and other
corporate actions must be classified explicitly rather than silently
treated as ordinary BUY/SELL activity. Tax treatment remains separate
from basic accounting P&L.

## 5. Architecture and implementation guardrails

-   Reuse existing transaction import, transaction services, holdings
    model, market-data structures where appropriate, and
    portfolio-service XIRR.
-   Inspect current code/schema before adding tables or abstractions.
    Assess whether existing `market_prices` can be extended or
    mutual-fund NAV needs a distinct table.
-   Keep provider adapters separate from domain calculations.
-   Preserve RED → GREEN → REFACTOR and the incremental, test-first
    approach.
-   Avoid adding dependencies without demonstrated need.
-   GitHub remains the canonical source for code and project
    documentation.
