# Investment Platform

## Master Requirements Draft

**Status:** Living document\
**Purpose:** Master reference for the evolving Personal Investment &
Portfolio Platform\
**Current development stage:** Transaction-driven holdings\
**Last updated:** September 30, 2026

------------------------------------------------------------------------

# 1. Product Vision

Build a personal investment and portfolio management platform that
provides a reliable view of an investor's financial assets,
transactions, holdings, performance, taxation-related information, and
historical portfolio state.

The platform is initially being developed as a personal investment and
portfolio management system, but is intended to evolve into a multi-user
product for Indian retail investors.

The application should evolve incrementally from a small but meaningful
domain model into a production-grade system.

The guiding principle is:

> **We do not build many disconnected toy applications. We build one
> application repeatedly, making it more production-grade as real
> requirements introduce new engineering problems.**

Architecture should therefore be driven by actual requirements rather
than by introducing technology or abstractions prematurely.

------------------------------------------------------------------------

# 2. Primary Objectives

The platform should eventually support:

-   Multiple users
-   Multiple investment portfolios
-   Securities and their exchange listings
-   Holdings
-   Investment transactions
-   Portfolio valuation
-   Market prices and market data
-   Investment performance
-   Transaction history
-   Historical portfolio analysis
-   Capital-gains and tax-related calculations
-   Transaction import
-   Investor-oriented reporting
-   Dashboards and visualizations
-   Multi-portfolio analysis
-   Notifications
-   Search
-   Background processing
-   Auditability
-   Data export
-   Mobile clients
-   Offline-capable workflows
-   Production deployment
-   Observability

------------------------------------------------------------------------

# 3. Product Direction

The initial release may be shared with a small group of users to
validate usability, product assumptions, and real investor requirements
before broader availability.

Potential future commercial model:

-   Free core portfolio functionality
-   Paid advanced analytics, reporting, tax-related capabilities,
    automation, and other premium features

The commercial model is not currently an implementation requirement.
Product decisions should first be driven by genuine investor needs and
observed usage.

The product should prioritize solving real investor problems while
preserving the principle that requirements drive architecture.
Monetization concerns should not introduce premature infrastructure or
abstractions.

# 3. Core Domain Model

The initial domain consists of:

``` text
User
  │
  └── Portfolio
        │
        ├── Holding ─── Security
        │                  │
        │                  └── Listing ─── Exchange
        │
        └── Transaction ─── Security
```

The important distinction is:

``` text
Transaction = historical event

Holding = current state
```

Transactions affect holdings, while transactions themselves remain
historical records.

For example:

``` text
BUY  100
BUY    5
SELL   3
---------
Holding = 102
```

This distinction will become important for historical analysis,
taxation, reconciliation, and portfolio reporting.

------------------------------------------------------------------------

# 4. Users

The system shall support users.

Initial attributes:

-   ID
-   Name
-   Email

Future requirements may include:

-   Authentication
-   Password/security management
-   External identity providers
-   User preferences
-   Notification preferences
-   Authorization

Authentication and authorization are intentionally not part of the
initial domain implementation.

------------------------------------------------------------------------

# 5. Portfolios

A user may have multiple portfolios.

Examples might eventually include:

-   Long-term investments
-   Retirement portfolio
-   Trading portfolio
-   Family portfolio

Initial requirements:

-   Create portfolio
-   Retrieve portfolio
-   Associate portfolio with a user
-   Retrieve holdings for a portfolio
-   Retrieve transactions for a portfolio

Future requirements:

-   Rename/archive portfolios
-   Portfolio-level valuation
-   Portfolio performance
-   Portfolio-level reporting
-   Portfolio-specific investment objectives

------------------------------------------------------------------------

# 6. Securities

A security represents the underlying investment instrument.

Initial model:

-   ID
-   Name

Examples:

-   Reliance Industries Limited
-   Tata Consultancy Services
-   Infosys

The security itself is distinct from its exchange listing.

------------------------------------------------------------------------

# 7. Exchanges and Listings

A security may be listed on multiple exchanges.

Examples:

``` text
Security:
Reliance Industries Limited

Listings:
NSE → RELIANCE
BSE → 500325
```

Requirements:

-   Maintain exchanges
-   Maintain security listings
-   Associate listings with securities
-   Support multiple listings for one security
-   Uniquely identify a security/exchange combination

This separation is important because an exchange symbol identifies a
listing, while the underlying security is the investment instrument.

------------------------------------------------------------------------

# 8. Holdings

A holding represents the current quantity of a security within a
portfolio.

Requirements:

-   A portfolio may hold multiple securities.
-   A security may appear in multiple portfolios.
-   There must be at most one holding for a given
    `(portfolio, security)` pair.
-   BUY transactions increase holdings.
-   SELL transactions decrease holdings.
-   A SELL cannot exceed the current holding.
-   A SELL requires an existing holding.
-   A BUY may create a holding if one does not already exist.

Current invariant:

``` text
UNIQUE(portfolio_id, security_id)
```

Whether zero-quantity holdings should remain persisted or be removed is
intentionally deferred.

------------------------------------------------------------------------

# 9. Transactions

Transactions represent historical investment activity.

Initial supported transaction types:

-   BUY
-   SELL

Initial attributes:

-   ID
-   Portfolio
-   Security
-   Transaction type
-   Quantity
-   Price
-   Transaction date

Initial invariants:

-   Quantity \> 0
-   Price \> 0
-   Portfolio must exist
-   Security must exist
-   Transaction type must be BUY or SELL

Transaction creation and the corresponding holding update must be
atomic.

Therefore:

``` text
Transaction creation
       +
Holding update
       ↓
One database transaction
```

If either operation fails, neither change should persist.

------------------------------------------------------------------------

# 10. Transaction Date and Temporal Data

Transaction dates are expected to become important beyond simple
display.

Potential future requirements include:

-   Capital-gains calculations
-   Short-term vs long-term holding periods
-   Tax-year calculations
-   Historical portfolio analysis
-   Queries over large date ranges
-   Reconstructing holdings at a point in time
-   Comparing portfolio state between two dates
-   Questions such as:

> How did my holding in security A change between date X and date Y?

Therefore transaction dates should be treated as **business data**, not
merely strings displayed by the UI.

Initial approach:

-   Represent transaction dates consistently using an ISO-8601
    representation.
-   For the current transaction model, a date-only value (`YYYY-MM-DD`)
    is sufficient.
-   SQLite persistence may use `TEXT`, since SQLite does not provide a
    native DATE type.
-   Date arithmetic and temporal calculations can be introduced when
    actual requirements emerge.

Future consideration:

If transaction timestamps become necessary---for example, intraday
trading, ordering multiple transactions on the same date, or precise
audit/reconciliation---we may distinguish:

``` text
transaction_date
created_at
updated_at
```

rather than conflating business date with system timestamp.

------------------------------------------------------------------------

# 11. Portfolio History

The system should eventually be capable of answering historical
questions such as:

-   What was my holding on a particular date?
-   How did my quantity change during a period?
-   Which transactions changed my holding?
-   What securities did I hold during a particular period?
-   What was my portfolio composition at the end of a tax year?
-   How much did I buy or sell during a period?

This requirement is one reason transaction history must remain immutable
historical data rather than being replaced by the current holding state.

------------------------------------------------------------------------

# 12. Market Data

Future requirements include integration with market-data providers.

Potential capabilities:

-   Current prices
-   Historical prices
-   Exchange information
-   Market status
-   Price history
-   Corporate actions

The platform should separate:

``` text
Investment data
```

from:

``` text
External market data
```

so that temporary provider/API failures do not corrupt the user's
investment records.

------------------------------------------------------------------------

# 13. Portfolio Valuation

Eventually the platform should calculate:

-   Current portfolio value
-   Security-level market value
-   Portfolio allocation
-   Cost/value comparisons
-   Historical portfolio value

Conceptually:

``` text
Holding quantity
        ×
Market price
        =
Market value
```

Historical valuation will eventually require both historical holdings
and historical market prices.

------------------------------------------------------------------------

# 14. Performance and Returns

Future requirements may include:

-   Absolute returns
-   Unrealized gains/losses
-   Realized gains/losses
-   Portfolio-level returns
-   Security-level returns
-   Time-weighted returns
-   Money-weighted returns / XIRR
-   Periodic performance

The calculation model should be driven by actual reporting requirements
rather than implemented prematurely.

------------------------------------------------------------------------

# 15. Tax and Capital Gains

Future requirements include support for Indian tax-related investment
calculations.

Potential capabilities:

-   Capital gains
-   Short-term vs long-term classification
-   Tax-year reporting
-   Transaction-level gain calculations
-   Cost basis
-   Sale-to-purchase matching
-   Corporate-action adjustments
-   Tax reports/export

The exact tax rules should be treated as a separate domain concern from
basic transaction storage.

------------------------------------------------------------------------

# 16. Transaction Import

Manual entry of years of historical transactions is impractical.

The platform should eventually support bulk transaction import.

Planned formats:

-   CSV
-   Excel
-   PDF

The import process should not directly insert untrusted parsed data into
the production transaction tables.

Expected workflow:

``` text
Import file
    ↓
Parse
    ↓
Validate
    ↓
Normalize
    ↓
Show review/preview
    ↓
User confirms
    ↓
Commit transactions
    ↓
Update holdings atomically
```

This will eventually introduce additional concerns such as:

-   Parsing
-   Validation
-   Duplicate detection
-   Security identification
-   Exchange/listing mapping
-   Date normalization
-   Error reporting
-   Import history
-   Idempotency

These are future requirements, not current implementation requirements.

------------------------------------------------------------------------

# 17. Search

Future search capabilities may include:

-   Securities
-   Listings
-   Portfolios
-   Transactions
-   Holdings

Search should evolve based on actual user workflows rather than
introducing a search engine prematurely.

------------------------------------------------------------------------

# 18. Dashboards and Visualization

Future UI requirements may include:

-   Portfolio summary
-   Allocation charts
-   Security-level holdings
-   Performance charts
-   Transaction history
-   Historical portfolio value
-   Capital gains summaries
-   Cash/investment allocation

The initial system should remain API/domain focused until meaningful UI
requirements emerge.

------------------------------------------------------------------------

# 19. Notifications

Potential future notifications:

-   Significant portfolio changes
-   Corporate actions
-   Price-related alerts
-   Import failures
-   Data synchronization failures
-   Scheduled reports

Notification delivery should eventually be decoupled from the
request/response path where appropriate.

------------------------------------------------------------------------

# 20. Background Jobs

Potential background processing:

-   Market-data synchronization
-   Historical price updates
-   Portfolio valuation
-   Report generation
-   Transaction import processing
-   Notifications
-   Data reconciliation
-   Scheduled maintenance

Background processing should be introduced when an actual workload
requires asynchronous execution.

------------------------------------------------------------------------

# 21. Auditability

The platform will eventually need to distinguish between:

``` text
Investment history
```

and:

``` text
System audit history
```

Investment history records what the investor did.

Audit history records what happened to application data and who/what
changed it.

Potential audit events:

-   Transaction creation
-   Transaction import
-   Data correction
-   Security changes
-   Portfolio changes
-   Administrative actions

Detailed audit infrastructure is deferred until required.

------------------------------------------------------------------------

# 22. Data Import and Export

Future requirements:

### Import

-   CSV
-   Excel
-   PDF
-   Potential broker-specific formats

### Export

-   Transactions
-   Holdings
-   Portfolio reports
-   Tax-related reports
-   Historical data

Exports should use stable, documented formats where practical.

------------------------------------------------------------------------

# 23. Mobile Clients

The domain/API should eventually support clients beyond the initial web
application.

Potential clients:

-   Web
-   Mobile
-   Other API consumers

This reinforces the requirement that business logic should not be
tightly coupled to the web UI.

------------------------------------------------------------------------

# 24. Offline Behaviour

Future mobile/client requirements may include:

-   Offline viewing
-   Locally cached portfolio information
-   Deferred synchronization
-   Conflict handling

Offline support is explicitly a future concern and should not influence
the initial architecture unnecessarily.

------------------------------------------------------------------------

# 25. Authentication and Authorization

Future requirements:

-   User authentication
-   Session/token management
-   Authorization
-   Portfolio ownership checks
-   API security
-   Potential role-based access control

Important future invariant:

> A user must only be able to access portfolios and investment data they
> are authorized to access.

------------------------------------------------------------------------

# 26. Caching

Potential future caching targets:

-   Market prices
-   Historical market data
-   Frequently accessed portfolio summaries
-   Security metadata

Caching should only be introduced when performance characteristics
demonstrate a need.

Investment records should remain authoritative in persistent storage.

------------------------------------------------------------------------

# 27. Observability

Future production requirements:

-   Structured logging
-   Error tracking
-   Metrics
-   Request tracing
-   Health checks
-   Database monitoring
-   Background-job monitoring

The goal is to make failures diagnosable rather than merely detectable.

------------------------------------------------------------------------

# 28. Deployment

The platform should eventually move from local development to production
deployment.

Potential concerns:

-   Production database
-   Secrets/configuration
-   HTTPS
-   Database migrations
-   Backups
-   Monitoring
-   Deployment automation
-   Rollbacks
-   Environment separation

The deployment architecture should be driven by the actual production
environment selected later.

------------------------------------------------------------------------

# 29. Data Integrity and Reliability

The system should prioritize correctness of financial data.

Important principles:

-   Database constraints should enforce fundamental invariants.
-   Business rules should live in the service/domain layer.
-   Multi-step financial state changes should be atomic.
-   Historical transactions should not be casually overwritten.
-   Imports should be validated before commitment.
-   External market data should not be allowed to corrupt investment
    records.
-   Database migrations should be versioned and repeatable.
-   Important operations should eventually be auditable.

------------------------------------------------------------------------

# 30. Current Database Model

Current core schema:

``` text
users
  │
  └── portfolios
        │
        ├── holdings ─── securities
        │                    │
        │                    └── listings ─── exchanges
        │
        └── transactions ─── securities
```

Current transaction/holding relationship:

``` text
Transaction
     │
     │ changes
     ▼
Holding
```

Current database migrations:

``` text
001_initial_schema
002_add_exchanges_and_listings
003_add_holding_uniqueness
004_add_test_securities
```

------------------------------------------------------------------------

# 31. Current API Capabilities

The application currently supports the core API operations developed
during the first development stages, including:

-   Users
-   Portfolios
-   Holdings
-   Securities
-   Transactions

Transaction APIs currently support:

``` text
POST /api/transactions
GET  /api/transactions/:id
GET  /api/portfolios/:portfolioId/transactions
```

Transaction creation updates holdings atomically.

------------------------------------------------------------------------

# 32. Engineering Principles

The project should follow these principles throughout its evolution.

### 1. Requirements drive architecture

Do not introduce infrastructure simply because it is technologically
interesting.

### 2. Prefer the smallest meaningful solution

Solve the actual problem before generalizing.

### 3. Preserve strong domain invariants

Financial correctness is more important than convenience.

### 4. Put responsibilities in the correct layer

``` text
Route
  → request/response concerns

Service
  → business rules and orchestration

Repository
  → persistence

Database
  → fundamental data integrity
```

### 5. Make important state transitions atomic

Especially where financial records and derived state change together.

### 6. Keep historical facts separate from current state

Transactions are historical events; holdings represent current state.

### 7. Defer complexity deliberately

Known future problems do not automatically become today's implementation
tasks.

### 8. Prefer evolutionary architecture

The architecture should become more sophisticated because requirements
demand it---not because we anticipate every possible future.

### 9. Solve genuine investor problems before optimizing for monetization

The product should earn complexity through real user needs and observed
usage. Commercial features should not distort the core domain or cause
premature architectural decisions.

------------------------------------------------------------------------

# 33. Future Requirement Areas

The following areas are recognized but intentionally not yet specified
in detail:

-   Authentication
-   Authorization
-   Market-data providers
-   Corporate actions
-   Cost-basis methodology
-   Tax rules
-   Transaction reconciliation
-   Broker integrations
-   Advanced portfolio analytics
-   Performance calculations
-   Notifications
-   Background processing
-   Search infrastructure
-   Caching
-   Audit infrastructure
-   File import pipeline
-   Mobile applications
-   Offline synchronization
-   Production deployment
-   Observability
-   Backup/recovery

These should be expanded only when the corresponding stage of the
project is reached.

------------------------------------------------------------------------

# 34. Guiding Architectural Question

At every new development stage, ask:

> **What is the next real requirement that forces the system to
> evolve?**

Then implement the smallest production-quality solution that satisfies
that requirement.

The objective is not to predict the final architecture.

The objective is to **discover the architecture through progressively
richer requirements.**
