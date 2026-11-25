# Personal Investment & Portfolio Platform --- Master Requirements Amendment

**Amendment date:** November 25, 2026\
**Product milestone:** Milestone 1 --- Zerodha Portfolio Management\
**Companion tracker:** `Implementation_Tracker_Amendment_2026-11-25.md`\
**Previous requirements checkpoint:** November 18, 2026\
**Purpose:** Clarify the initial product workflow and acceptance
requirements for a usable Zerodha investment portfolio. This amendment
supplements earlier master requirements; it does not erase prior
technical decisions or completion evidence.

## 1. Product objective

The initial product milestone shall deliver a usable
investment-management experience for a user's Zerodha investments.

A user shall be able to: 1. Sign in. 2. Create a portfolio representing
Zerodha. 3. Import historical equity transactions. 4. Import historical
mutual-fund transactions. 5. Review and apply staged imports. 6. Import
updated reports periodically, normally monthly. 7. View holdings,
valuation and investment performance.

The Zerodha portfolio contains both equity and mutual-fund investments.
The user should not need to create separate portfolios by asset class.

## 2. Portfolio concepts and scope

### 2.1 Initial portfolio model

For this milestone: - The user creates one portfolio, for example
`Zerodha`. - That portfolio contains all supported Zerodha equity and
mutual-fund investments. - The portfolio is the primary boundary for
holdings, transactions, valuation and performance. - The same portfolio
may be viewed through asset-class filters such as equity and mutual
funds. - Asset class and instrument type are classifications of
investments, not separate portfolio ownership boundaries. - With only
one provider in scope, this portfolio also serves as the consolidated
portfolio view. A separate consolidated-portfolio entity is not required
initially.

### 2.2 Provider independence

The application shall model investments and their classifications
independently of the external platform's own presentation.

The initial supported provider is Zerodha. Other providers, including
WealthIndia, UvaWealth and WintWealth, are outside this milestone.

The design should preserve source/provider identity so additional
providers can be introduced later without changing the meaning of
securities, transactions or financial calculations.

### 2.3 Instrument classification

The system shall distinguish, as needed for reporting: - Instrument
type: stock, ETF, mutual fund, bond and other supported instruments. -
Asset exposure/class: equity, debt, hybrid, gold and other supported
categories. - Trading/valuation mechanism: exchange-traded, NAV-based or
another applicable mechanism.

Classification must not be inferred solely from the platform or report
name. A security's classification should be maintained as
security/reference data and used consistently across views.

## 3. Import requirements

### 3.1 Supported sources

The first release shall support user-uploaded Zerodha reports for: -
Equity transactions. - Mutual-fund transactions.

The two report types may have different source formats and parsing
adapters. Both shall normalize into the common internal transaction
representation.

Broker API integration is explicitly deferred. An API connector may
later feed the same normalization and staging pipeline.

### 3.2 Import workflow

Every supported import shall follow:

`Upload → Identify/select format → Parse/normalize → Validate → Stage → Preview/review → Explicit apply`

Requirements: - Identify the provider and report type, either
automatically with sufficient confidence or through explicit user
selection. - Verify that the import is appropriate for the selected
portfolio. - Preserve the original source evidence. - Report row-level
validation errors and warnings. - Resolve security identity using stable
identifiers where available (for example, ISIN for applicable
instruments), with controlled fallback rules. - Display the staged batch
and its items before application. - Require explicit user action to
apply. - Staging must not create financial transactions or alter
holdings. - Applying must use the existing atomic transaction
workflow. - Failed application must not leave partial financial effects.

### 3.3 Provenance and auditability

For each imported transaction, preserve sufficient information to trace
it back to its source, including where available: - Provider/platform. -
Report type. - Import batch. - Original filename. - Original source row
number. - Broker trade/execution identifier. - Broker order
identifier. - External security identifier (such as ISIN).

The implementation must ensure provenance remains traceable after the
staged item is applied to a financial transaction. If the current schema
does not provide that association, document and test the smallest
suitable solution before changing the schema.

### 3.4 Monthly and overlapping imports

The system shall support repeated imports over time, including reports
whose date ranges overlap previously imported reports.

Requirements: - Re-uploading the exact same file must not create
duplicate financial transactions. - A modified or overlapping report
must be checked at transaction level; file hashing alone is
insufficient. - Transaction identity must use reliable source
identifiers where available. - When source identifiers are absent, use a
documented identity strategy that does not discard legitimate distinct
executions. - Identical date, security, transaction type, quantity and
price values are not, by themselves, proof that two records are
duplicates. - Confirmed distinct executions must both be retained. - The
preview must make duplicate candidates, skipped rows, warnings and new
rows understandable to the user.

### 3.5 Historical import

Historical imports shall support the available source-report coverage
and preserve transaction dates and source details.

For the prepared mutual-fund dataset: - 477 selected transactions
represent 10 active schemes in the November 16, 2026 holdings
statement. - The dataset reconciles by signed units to the statement's
closing scheme balances to three decimal places. - Two identical-looking
ICICI Prudential Income Plus Arbitrage Omni FoF purchases dated May 5,
2026 are distinct executions and must both be retained. - The prepared
dataset has not yet been imported into the application; completion
requires staging, review, application and post-import reconciliation.

Historical equity import shall be assessed and reconciled independently
against appropriate Zerodha reports/statements.

## 4. Holdings and valuation requirements

### 4.1 Holdings

Holdings shall be derived from applied transactions and supported
corporate actions, not from unreviewed staged rows.

The portfolio shall support: - Security-level units/quantity. - Equity
and mutual-fund holdings in the same portfolio. - Historical transaction
lookup. - Holdings as of a requested date, subject to available
transaction and price history. - Reconciliation against external
statements.

### 4.2 As-of-date valuation

Portfolio valuation shall be based on persisted market data: - Listed
equity and ETFs use the latest valid closing price on or before the
selected valuation date. - Mutual funds use the applicable NAV effective
on or before the selected valuation date. - The valuation response/UI
shall disclose the effective price/NAV date used. - Weekends, market
holidays, missing prices and stale data must be handled explicitly. - Do
not imply that a value is an exact same-day close/NAV if the latest
available data is older. - Portfolio calculations and dashboard
rendering should not depend on making a live external market-data
request for every view.

Bond valuation is outside the first valuation scope unless the existing
implementation already supports a reliable, documented method.

### 4.3 Historical valuation

The system should support portfolio valuation over time using historical
transactions and persisted historical prices/NAVs. A chart of portfolio
value must be clearly distinguished from a return measure because
contributions and withdrawals affect value.

## 5. Performance and investor analytics

The initial investor-facing experience should progressively provide:

### Portfolio overview

-   Total current value and valuation date.
-   Invested amount/cost basis, with calculation semantics documented.
-   Realized and unrealized gain/loss when the required lot accounting
    is available.
-   Asset allocation by exposure/classification.
-   Equity versus mutual-fund breakdown.

### Holdings analytics

-   Units/quantity.
-   Latest available price or NAV and its effective date.
-   Market value.
-   Cost basis and unrealized gain/loss when supported.
-   Security/scheme-level performance where calculation semantics are
    valid.

### Portfolio performance

-   Historical portfolio valuation.
-   Portfolio XIRR using the existing portfolio-service implementation
    after its cash-flow semantics are validated.
-   Realized and unrealized P&L, with no double counting.
-   Clear treatment of external cash flows, purchases, sales, dividends,
    reinvestments, splits and other supported events.

**Calculation rule:** Consolidated/portfolio XIRR must be computed from
the relevant dated cash flows and terminal valuation. It must not be
calculated by taking a simple average of individual instrument or
category returns.

Valuation growth and investment return are different measures and must
be labelled accordingly.

## 6. Financial correctness

-   Holdings quantities must reconcile to the applied transaction ledger
    and supported corporate actions.
-   FIFO acquisition-lot accounting shall be deterministic and auditable
    where required for realized/unrealized P&L.
-   Redemptions/sales must not consume more units than available.
-   Same-day transaction ordering must use execution time or another
    reliable sequence where available.
-   Switch/STP legs, dividends/reinvestments, splits, reversals and
    other non-standard activity must be explicitly classified; do not
    silently treat every row as ordinary BUY or SELL.
-   Tax treatment remains separate from basic accounting P&L.
-   Decimal precision and rounding rules must be explicit and tested.
-   Existing XIRR implementation shall be reused and extended rather
    than duplicated.

## 7. User experience requirements

The first useful UI shall provide: - Portfolio creation and selection. -
Import entry points for supported Zerodha equity and mutual-fund
reports. - Staged batch preview, validation feedback and explicit apply
confirmation. - Portfolio overview. - Holdings list with equity and
mutual-fund filters. - Transaction history. - Asset allocation. -
Valuation and performance views as the underlying calculations become
reliable. - Loading, empty, validation-error, import-error, stale-data
and missing-data states.

The interface should not expose unnecessary provider-specific complexity
to the investor. It should explain what data was imported, what needs
attention and what the resulting portfolio value/performance represents.

## 8. Explicitly deferred scope

The following are not required for Milestone 1: - WealthIndia, UvaWealth
and WintWealth import adapters. - Broker/platform API integrations. -
Multiple consolidated portfolios. - Multiple external accounts under one
provider. - Family or goal-based portfolio aggregation. - Splitting one
execution across multiple portfolios. - Advanced tax reporting and tax
optimization. - Sophisticated bond pricing/accrued-interest valuation. -
Cross-provider reconciliation and duplicate detection.

The architecture should avoid blocking these future capabilities, but
should not implement them ahead of demonstrated need.

## 9. Acceptance criteria for Milestone 1

Milestone 1 is complete when: 1. A user can create and manage a Zerodha
portfolio through the UI. 2. Equity and mutual-fund transactions can
both be imported into that same portfolio. 3. Historical imports are
staged, reviewed and explicitly applied. 4. The prepared 477-row MF
dataset is imported and reconciled to the 10-scheme statement balances.
5. Supported historical equity imports are reconciled to their source
statements. 6. Monthly imports work safely with overlapping report
periods. 7. Duplicate protection retains legitimate distinct executions
and preserves source provenance. 8. Holdings and valuation use the
correct instrument-specific price/NAV data and disclose valuation dates.
9. Portfolio and instrument analytics are backed by tested financial
calculations. 10. The UI provides a useful portfolio overview, holdings,
transaction history and validated performance views. 11. Backend
regression tests, frontend tests and production build pass; actual
results are recorded in the tracker.

## 10. Engineering guardrails

-   Follow RED → GREEN → REFACTOR.
-   Inspect existing schema, services and tests before introducing new
    abstractions or migrations.
-   Reuse the existing import pipeline, transaction services, holdings
    model and XIRR implementation where appropriate.
-   Keep adapters responsible for source-format interpretation; keep
    normalized domain calculations provider-independent.
-   Keep staging separate from financial application.
-   Preserve transaction provenance and source evidence.
-   Treat GitHub as the canonical source for implementation and project
    documentation.
