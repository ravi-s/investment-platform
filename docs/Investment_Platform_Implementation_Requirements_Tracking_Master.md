# Investment Platform --- Implementation & Requirements Tracking Master

**Document type:** Living implementation tracker\
**Purpose:** Authoritative record of what is implemented, partially
implemented, deferred, or not yet started.\
**Companion document:**
`Investment_Platform_Master_Requirements_Draft_Updated.md`\
**Tracking baseline:** End of Day 17\
**Last updated:** October 6, 2026

------------------------------------------------------------------------

# 1. Purpose

This document exists to prevent confusion between:

1.  what the platform is intended to support,
2.  what has actually been implemented,
3.  what is only partially implemented,
4.  what has deliberately been deferred, and
5.  what has not yet been started.

The **Master Requirements** document remains the source of truth for
product and domain requirements.

This document is the source of truth for **implementation status**.

The implementation tracker must be updated whenever a meaningful
requirement is completed, partially completed, explicitly deferred, or
superseded.

------------------------------------------------------------------------

# 2. Status Definitions

  -----------------------------------------------------------------------
  Status                              Meaning
  ----------------------------------- -----------------------------------
  ✅ Complete                         The currently defined requirement
                                      is implemented and covered by
                                      appropriate tests or other explicit
                                      evidence.

  🟡 Partial                          Some meaningful part of the
                                      requirement is implemented, but
                                      additional defined capability
                                      remains.

  ⬜ Not Started                      No meaningful implementation has
                                      been completed yet.

  🔵 Deferred                         Deliberately postponed. The
                                      requirement is known but should not
                                      currently drive implementation.
  -----------------------------------------------------------------------

### Important rule

**Do not mark an entire requirement Complete merely because one part of
it works.**

When a requirement contains multiple capabilities, record the individual
capabilities separately or explain the remaining work in the Notes
column.

------------------------------------------------------------------------

# 3. Implementation Principles

The tracker follows the project's existing engineering principles:

-   Requirements drive architecture.
-   Prefer the smallest meaningful solution.
-   Preserve strong domain invariants.
-   Keep responsibilities separated between route, service, repository,
    and database.
-   Important state transitions should be atomic.
-   Historical facts must remain distinct from current state.
-   Complexity should be introduced only when a real requirement
    requires it.
-   The application evolves incrementally rather than through
    disconnected toy applications.
-   Tests are evidence of completed domain behavior.
-   A completed feature is not reopened merely because a later feature
    depends on it.

The guiding question remains:

> **What is the next real requirement that forces the system to
> evolve?**

------------------------------------------------------------------------

# 4. Current Development Baseline

## End of Day 17

**Known test status:** 72 tests passing, 0 failing.

The project has progressed beyond the original transaction-driven
holding model and now includes historical portfolio behavior, valuation,
investment events/dividends, and stock-split handling.

The next development day must be selected from this tracker rather than
inferred from the broad roadmap alone.

------------------------------------------------------------------------

# 5. Core Domain Implementation Status

## 5.1 Users

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  User entity             ✅ Complete             Users are persisted and
                                                  used by portfolios and
                                                  tests.

  User ID                 ✅ Complete             Database-backed
                                                  identifier.

  User name               ✅ Complete             Initial domain
                                                  attribute.

  User email              ✅ Complete             Initial domain
                                                  attribute.

  Authentication          🔵 Deferred             Explicitly outside the
                                                  initial domain
                                                  implementation.

  Authorization           🔵 Deferred             Future portfolio
                                                  ownership/security
                                                  requirement.

  External identity       🔵 Deferred             Future requirement.
  providers                                       

  User preferences        🔵 Deferred             Future requirement.

  Notification            🔵 Deferred             Future requirement.
  preferences                                     
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 5.2 Portfolios

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Create portfolio        ✅ Complete             Implemented in
                                                  persistence/API
                                                  workflow.

  Retrieve portfolio      ✅ Complete             Implemented.

  Associate portfolio     ✅ Complete             Database relationship
  with user                                       implemented.

  Retrieve portfolio      ✅ Complete             Implemented through
  holdings                                        holding/domain
                                                  services.

  Retrieve portfolio      ✅ Complete             Implemented through
  transactions                                    transaction
                                                  service/API.

  Multiple portfolios per ✅ Complete             Domain model supports
  user                                            this.

  Rename/archive          ⬜ Not Started          Future requirement.
  portfolio                                       

  Portfolio-level         ✅ Complete             Historical/current
  valuation                                       valuation capability
                                                  has been implemented.

  Portfolio performance   🟡 Partial              Performance domain
                                                  exists, but full
                                                  roadmap scope remains
                                                  to be defined and
                                                  completed.

  Portfolio-level         ⬜ Not Started          Future reporting
  reporting                                       capability.

  Investment objectives   ⬜ Not Started          Future requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 5.3 Securities

  Requirement           Status        Evidence / Notes
  --------------------- ------------- -----------------------------
  Security entity       ✅ Complete   Implemented.
  Security ID           ✅ Complete   Database-backed identifier.
  Security name         ✅ Complete   Initial domain attribute.
  Security repository   ✅ Complete   Implemented and tested.

------------------------------------------------------------------------

## 5.4 Exchanges and Listings

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Exchange entity         ✅ Complete             Implemented through
                                                  schema/migrations.

  Security listings       ✅ Complete             Implemented.

  Associate listing with  ✅ Complete             Implemented.
  security                                        

  Multiple listings per   ✅ Complete             Domain supports
  security                                        exchange-specific
                                                  listings.

  Unique                  ✅ Complete             Database/domain
  security/exchange                               constraint implemented.
  combination                                     

  Full market-data        ⬜ Not Started          Separate future
  integration                                     capability.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 6. Holdings

  -------------------------------------------------------------------------
  Requirement               Status                  Evidence / Notes
  ------------------------- ----------------------- -----------------------
  Holding entity            ✅ Complete             Implemented.

  One holding per           ✅ Complete             Uniqueness constraint
  `(portfolio, security)`                           implemented.

  BUY increases holding     ✅ Complete             Implemented and tested.

  SELL decreases holding    ✅ Complete             Implemented and tested.

  SELL cannot exceed        ✅ Complete             Business invariant
  current holding                                   tested.

  SELL requires existing    ✅ Complete             Business invariant
  holding                                           tested.

  BUY can create holding    ✅ Complete             Implemented.

  Historical holding as of  ✅ Complete             Implemented and tested.
  date                                              

  Holding change between    ✅ Complete             Implemented and tested.
  dates                                             

  Securities held as of     ✅ Complete             Implemented and tested.
  date                                              

  Portfolio composition as  ✅ Complete             Implemented and tested.
  of date                                           

  Zero-quantity holding     🔵 Deferred             Explicitly left open in
  lifecycle                                         requirements.
  -------------------------------------------------------------------------

------------------------------------------------------------------------

# 7. Transactions

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Transaction entity      ✅ Complete             Implemented.

  BUY transaction         ✅ Complete             Implemented and tested.

  SELL transaction        ✅ Complete             Implemented and tested.

  Transaction date        ✅ Complete             Date-only business
                                                  representation
                                                  implemented.

  Quantity validation     ✅ Complete             Positive quantity
                                                  invariant.

  Price validation        ✅ Complete             Positive price
                                                  invariant.

  Portfolio existence     ✅ Complete             Service/repository
  validation                                      workflow.

  Security existence      ✅ Complete             Service/repository
  validation                                      workflow.

  Atomic transaction +    ✅ Complete             Important state
  holding update                                  transition implemented
                                                  transactionally.

  Transaction filtering   ✅ Complete             Implemented.
  by date range                                   

  Newest-first            ✅ Complete             Date/id ordering
  transaction ordering                            implemented.

  Transaction history     ✅ Complete             Historical replay
  reconstruction                                  implemented.

  FIFO-related historical 🟡 Partial              FIFO semantics have
  behavior                                        been defined and
                                                  exercised in
                                                  performance-related
                                                  work; complete
                                                  tax/capital-gain
                                                  matching remains future
                                                  scope.

  SPLIT transaction       ✅ Complete             Added through
                                                  corporate-action work.

  Additional transaction  🔵 Deferred             Only introduce when a
  types                                           real requirement
                                                  requires them.

  Intraday transaction    🔵 Deferred             Date-only model remains
  timestamps                                      sufficient until a real
                                                  requirement forces
                                                  timestamps.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 8. Portfolio History

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Holding on a particular ✅ Complete             Implemented and tested.
  date                                            

  Quantity change between ✅ Complete             Implemented and tested.
  dates                                           

  Transactions affecting  🟡 Partial              Transaction history is
  a holding                                       available; dedicated
                                                  reporting/query
                                                  semantics may still
                                                  evolve.

  Securities held during  ✅ Complete             Implemented.
  a period                                        

  Portfolio composition   ✅ Complete             Implemented.
  at a historical date                            

  Buy/sell totals for a   🟡 Partial              Underlying transaction
  period                                          filtering exists;
                                                  dedicated reporting may
                                                  remain.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 9. Portfolio Valuation

  -------------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -------------------------
  Security-level market   ✅ Complete             Implemented.
  value                                           

  Portfolio valuation     ✅ Complete             Implemented.

  Historical valuation    ✅ Complete             Valuation can use
                                                  historical holdings and
                                                  market prices.

  Portfolio composition   ✅ Complete             Implemented.
  with acquisition amount                         

  Allocation reporting    🟡 Partial              Underlying composition
                                                  exists; richer
                                                  reporting/visualization
                                                  remains future scope.

  External market-data    ⬜ Not Started          Current market-price
  provider                                        domain is not equivalent
                                                  to external provider
                                                  integration.
  -------------------------------------------------------------------------

------------------------------------------------------------------------

# 10. Market Prices and Market Data

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Market-price            ✅ Complete             Market price
  persistence                                     migration/service work
                                                  completed.

  Historical market       ✅ Complete             Historical price data
  prices                                          is part of valuation
                                                  workflow.

  Price lookup for        ✅ Complete             Used by portfolio
  valuation                                       valuation.

  External market-data    ⬜ Not Started          Future requirement.
  provider integration                            

  Current market status   ⬜ Not Started          Future requirement.

  Provider                ⬜ Not Started          Future/background
  synchronization                                 processing requirement.

  Provider failure        🔵 Deferred             Architecture concern to
  isolation                                       be addressed when
                                                  external integration
                                                  begins.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 11. Investment Events and Dividends

## 11.1 Investment Events

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Investment event model  ✅ Complete             Implemented.

  DIVIDEND event type     ✅ Complete             Implemented.

  Ex-date                 ✅ Complete             Persisted.

  Record date             ✅ Complete             Persisted.

  Payment date            ✅ Complete             Persisted.

  Amount per unit         ✅ Complete             Persisted and
                                                  validated.

  Currency                ✅ Complete             Persisted.

  Event-date constraints  ✅ Complete             Domain/database checks
                                                  implemented.
  -----------------------------------------------------------------------

## 11.2 Dividend Workflow

  -------------------------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -------------------------------------
  Calculate dividend from ✅ Complete             `eligibleQuantity × amountPerUnit`.
  eligible quantity                               

  Determine eligibility   ✅ Complete             Uses historical holding as of record
  from record-date                                date.
  holding                                         

  Calculate portfolio     ✅ Complete             Investment-event service workflow
  dividend income                                 implemented.

  Dividend test coverage  ✅ Complete             Dedicated unit and integration-style
                                                  tests exist.

  Dividend                ⬜ Not Started          No separate cash/income ledger has
  payment/accounting                              been introduced.
  ledger                                          

  Dividend tax treatment  ⬜ Not Started          Future tax domain.
  -------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 12. Corporate Actions

## 12.1 Stock Split

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  SPLIT transaction type  ✅ Complete             Implemented.

  Split                   ✅ Complete             Implemented.
  numerator/denominator                           

  Quantity adjustment     ✅ Complete             Historical holdings are
                                                  adjusted according to
                                                  split ratio.

  Pre-split transactions  ✅ Complete             Replay logic preserves
  remain historical                               historical events.

  Post-split transactions ✅ Complete             Tested.
  remain distinct                                 

  Sell before split then  ✅ Complete             Tested.
  split                                           

  Buy after split         ✅ Complete             Tested.

  Historical holding      ✅ Complete             Tested.
  after split                                     

  Stock-split test suite  ✅ Complete             Included in
                                                  transaction-history
                                                  testing.
  -----------------------------------------------------------------------

**Conclusion:** Stock Split is **Complete** for the currently defined
scope.

## 12.2 Other Corporate Actions

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Bonus shares            ⬜ Not Started          Future requirement.

  Mergers                 ⬜ Not Started          Future requirement.

  Demergers               ⬜ Not Started          Not currently defined
                                                  as an explicit
                                                  requirement.

  Rights issues           ⬜ Not Started          Not currently defined
                                                  as an explicit
                                                  requirement.

  General                 🔵 Deferred             Do not generalize until
  corporate-action                                another corporate
  framework                                       action creates a real
                                                  requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 13. Performance and Returns

This area requires careful tracking because some performance-related
functionality has already been explored while the complete future
requirement remains broader.

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Performance             🟡 Partial              PerformanceService
  domain/service                                  exists and has
                                                  dedicated tests.

  Market value            🟡 Partial              Valuation capability
                                                  exists; integration
                                                  into complete return
                                                  reporting must be
                                                  assessed separately.

  Acquisition cost        🟡 Partial              Portfolio composition
                                                  supports acquisition
                                                  amount.

  Realized gain/loss      🟡 Partial              Domain semantics have
                                                  been explored; full
                                                  reporting scope
                                                  remains.

  Unrealized gain/loss    🟡 Partial              Domain/test work
                                                  exists; complete
                                                  reporting scope
                                                  remains.

  Dividend contribution   🟡 Partial              Dividend income
  to investment return                            calculation exists;
                                                  integration into
                                                  complete return metrics
                                                  remains to be defined.

  Short-term return       🟡 Partial              Domain rule
  semantics                                       discussed/tested but
                                                  complete reporting
                                                  capability remains.

  Long-term CAGR/XIRR     🟡 Partial              XIRR-related semantics
  semantics                                       have been discussed;
                                                  full implementation
                                                  scope remains.

  Time-weighted return    ⬜ Not Started          Future requirement.

  Money-weighted return / 🟡 Partial              Identified as a
  XIRR                                            required metric, but
                                                  not yet treated as a
                                                  complete reporting
                                                  capability.

  Periodic performance    ⬜ Not Started          Future requirement.

  Portfolio-level         ⬜ Not Started          Requires final
  performance reporting                           reporting contract.
  -----------------------------------------------------------------------

**Next action:** Before adding more performance code, define the exact
currently required performance output and mark each calculation as
independently complete/partial.

------------------------------------------------------------------------

# 14. Tax and Capital Gains

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Capital gains           ⬜ Not Started          Future domain.

  Short-term vs long-term ⬜ Not Started          Requirement identified.
  classification                                  

  Tax-year reporting      ⬜ Not Started          Requirement identified.

  Transaction-level gain  ⬜ Not Started          Future tax domain.
  calculation                                     

  Cost basis for tax      🟡 Partial              Historical acquisition
  purposes                                        information exists, but
                                                  tax-specific cost-basis
                                                  rules are not
                                                  implemented.

  Sale-to-purchase        ⬜ Not Started          FIFO semantics exist
  matching                                        conceptually; tax
                                                  calculation is not
                                                  implemented.

  Corporate-action tax    ⬜ Not Started          Future requirement.
  adjustments                                     

  Indian tax rules        ⬜ Not Started          Must be introduced as a
                                                  separate domain with
                                                  explicit rules.

  Tax reports/export      ⬜ Not Started          Future requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 15. Transaction Import

  --------------------------------------------------------------------------
  Requirement                Status                  Evidence / Notes
  -------------------------- ----------------------- -----------------------
  CSV import                 ⬜ Not Started          Planned.

  Excel import               ⬜ Not Started          Planned.

  PDF import                 ⬜ Not Started          Planned.

  Parse/validate/normalize   ⬜ Not Started          Future workflow.
  workflow                                           

  Preview/review before      ⬜ Not Started          Future workflow.
  commit                                             

  Duplicate detection        ⬜ Not Started          Future requirement.

  Security                   ⬜ Not Started          Future requirement.
  identification/mapping                             

  Error reporting            ⬜ Not Started          Future requirement.

  Import history             ⬜ Not Started          Future requirement.

  Idempotency                ⬜ Not Started          Future requirement.

  Atomic commit/update       🟡 Partial              Existing transaction
  holdings                                           workflow provides the
                                                     domain primitive;
                                                     import orchestration is
                                                     not implemented.
  --------------------------------------------------------------------------

------------------------------------------------------------------------

# 16. Search

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Security search         ⬜ Not Started          Future requirement.

  Listing search          ⬜ Not Started          Future requirement.

  Portfolio search        ⬜ Not Started          Future requirement.

  Transaction search      ⬜ Not Started          Date filtering exists
                                                  but general search is
                                                  not implemented.

  Holding search          ⬜ Not Started          Future requirement.

  Dedicated search engine 🔵 Deferred             Introduce only if
                                                  actual scale/workload
                                                  requires it.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 17. Dashboards and Visualization

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Portfolio summary UI    ⬜ Not Started          Current system remains
                                                  API/domain focused.

  Allocation charts       ⬜ Not Started          Future UI requirement.

  Security-level holdings ⬜ Not Started          Future UI requirement.
  UI                                              

  Performance charts      ⬜ Not Started          Future UI requirement.

  Transaction history UI  ⬜ Not Started          Future UI requirement.

  Historical portfolio    ⬜ Not Started          Future UI requirement.
  value UI                                        

  Capital-gains UI        ⬜ Not Started          Depends on tax domain.

  Cash/investment         ⬜ Not Started          Future UI requirement.
  allocation UI                                   
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 18. Notifications

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Portfolio-change        ⬜ Not Started          Future requirement.
  notifications                                   

  Corporate-action        ⬜ Not Started          Future requirement.
  notifications                                   

  Price alerts            ⬜ Not Started          Future requirement.

  Import-failure          ⬜ Not Started          Future requirement.
  notifications                                   

  Data-sync failure       ⬜ Not Started          Future requirement.
  notifications                                   

  Scheduled reports       ⬜ Not Started          Future requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 19. Background Jobs

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Market-data             ⬜ Not Started          Future workload.
  synchronization                                 

  Historical price        ⬜ Not Started          Future workload.
  updates                                         

  Portfolio valuation     ⬜ Not Started          Introduce when workload
  jobs                                            requires it.

  Report generation jobs  ⬜ Not Started          Future requirement.

  Transaction import      ⬜ Not Started          Future requirement.
  processing                                      

  Notification jobs       ⬜ Not Started          Future requirement.

  Data reconciliation     ⬜ Not Started          Future requirement.

  Scheduled maintenance   ⬜ Not Started          Future requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 20. Auditability

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Distinguish investment  🔵 Deferred             Concept defined;
  history from audit                              infrastructure
  history                                         intentionally deferred.

  Transaction creation    ⬜ Not Started          Future requirement.
  audit                                           

  Transaction import      ⬜ Not Started          Future requirement.
  audit                                           

  Data correction audit   ⬜ Not Started          Future requirement.

  Security-change audit   ⬜ Not Started          Future requirement.

  Portfolio-change audit  ⬜ Not Started          Future requirement.

  Administrative audit    ⬜ Not Started          Future requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 21. Data Import and Export

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Transaction import      ⬜ Not Started          See Transaction Import
                                                  section.

  Holdings export         ⬜ Not Started          Future requirement.

  Transaction export      ⬜ Not Started          Future requirement.

  Portfolio reports       ⬜ Not Started          Future requirement.
  export                                          

  Tax-report export       ⬜ Not Started          Depends on tax domain.

  Historical data export  ⬜ Not Started          Future requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 22. Mobile Clients

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Web/API-independent     ✅ Complete             Domain/service
  domain logic                                    architecture is
                                                  API-oriented.

  Mobile client           ⬜ Not Started          Future requirement.

  Other API consumers     ⬜ Not Started          Future requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 23. Offline Behaviour

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Offline viewing         ⬜ Not Started          Future client
                                                  requirement.

  Local portfolio cache   ⬜ Not Started          Future client
                                                  requirement.

  Deferred                ⬜ Not Started          Future client
  synchronization                                 requirement.

  Conflict handling       ⬜ Not Started          Future client
                                                  requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 24. Authentication and Authorization

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  User authentication     ⬜ Not Started          Explicitly deferred
                                                  from initial domain.

  Session/token           ⬜ Not Started          Future requirement.
  management                                      

  Portfolio ownership     ⬜ Not Started          Future security
  checks                                          invariant.

  API security            ⬜ Not Started          Future requirement.

  Role-based access       ⬜ Not Started          Future requirement.
  control                                         
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 25. Caching

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Market-price caching    ⬜ Not Started          Introduce when
                                                  performance requires
                                                  it.

  Historical market-data  ⬜ Not Started          Future requirement.
  caching                                         

  Portfolio-summary       ⬜ Not Started          Future requirement.
  caching                                         

  Security metadata       ⬜ Not Started          Future requirement.
  caching                                         

  Cache as authoritative  🔵 Deferred / Principle Persistent storage
  investment storage                              remains authoritative.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 26. Observability

  Requirement                 Status           Evidence / Notes
  --------------------------- ---------------- --------------------------------
  Structured logging          ⬜ Not Started   Future production requirement.
  Error tracking              ⬜ Not Started   Future requirement.
  Metrics                     ⬜ Not Started   Future requirement.
  Request tracing             ⬜ Not Started   Future requirement.
  Health checks               ⬜ Not Started   Future requirement.
  Database monitoring         ⬜ Not Started   Future requirement.
  Background-job monitoring   ⬜ Not Started   Future requirement.

------------------------------------------------------------------------

# 27. Deployment

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Production database     ⬜ Not Started          Future deployment
                                                  stage.

  Secrets/configuration   ⬜ Not Started          Future requirement.
  management                                      

  HTTPS                   ⬜ Not Started          Future deployment
                                                  requirement.

  Production migrations   🟡 Partial              Migration system
                                                  exists; production
                                                  deployment workflow
                                                  remains.

  Backups                 ⬜ Not Started          Future requirement.

  Monitoring              ⬜ Not Started          Future requirement.

  Deployment automation   ⬜ Not Started          Future requirement.

  Rollbacks               ⬜ Not Started          Future requirement.

  Environment separation  ⬜ Not Started          Future deployment
                                                  requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 28. Data Integrity and Reliability

  -----------------------------------------------------------------------
  Requirement             Status                  Evidence / Notes
  ----------------------- ----------------------- -----------------------
  Database foreign-key    ✅ Complete             Foreign-key enforcement
  integrity                                       is part of
                                                  test/database setup.

  Domain validation       ✅ Complete             Zod/service validation
                                                  introduced where
                                                  required.

  Atomic financial state  ✅ Complete             Transaction + holding
  transitions                                     updates use atomic
                                                  database behavior.

  Migration system        ✅ Complete             Migration runner and
                                                  migration history
                                                  implemented.

  Test database isolation ✅ Complete             Introduced during
                                                  testing evolution.

  Automated               ✅ Complete             Vitest established and
  unit/integration tests                          actively used.

  Self-contained          🟡 Partial              Migration/test history
  migration history                               has been hardened
                                                  during development;
                                                  continue treating
                                                  migration
                                                  reproducibility as a
                                                  tracked reliability
                                                  concern.

  Backup/recovery         ⬜ Not Started          Future production
                                                  requirement.

  Reconciliation          ⬜ Not Started          Future requirement.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 29. Completed Domain Milestones

The following milestones are considered completed at the current
baseline:

1.  Core users and portfolios.
2.  Securities.
3.  Exchanges and listings.
4.  Holdings.
5.  BUY/SELL transactions.
6.  Atomic transaction/holding updates.
7.  Transaction filtering and ordering.
8.  Historical holding reconstruction.
9.  Historical holding change.
10. Securities held as of a date.
11. Historical portfolio composition.
12. Portfolio valuation.
13. Market-price persistence and historical price usage.
14. Investment events.
15. Dividend entitlement and income calculation.
16. Stock-split transaction and historical replay behavior.
17. Test infrastructure and isolated test database behavior.

------------------------------------------------------------------------

# 30. Known Partial Areas

The following areas should **not** currently be treated as completely
implemented:

### Performance and Returns

Performance-related code and tests exist, but the complete reporting
contract across:

-   realized gains,
-   unrealized gains,
-   dividend income,
-   short-term returns,
-   long-term returns,
-   XIRR,
-   time-weighted returns,
-   periodic performance,

has not yet been declared as one finished feature.

### Tax and Capital Gains

Historical transaction/FIFO foundations exist, but Indian tax
calculations, tax-year classification, capital-gains reporting, and tax
exports remain future work.

### Market Data

Historical market-price persistence exists, but external
market-data-provider integration and synchronization are future work.

### Production Operations

The application has a functioning development/test foundation, but
production deployment, observability, backups, monitoring, and
operational recovery remain future work.

------------------------------------------------------------------------

# 31. Explicitly Completed vs Future Corporate Actions

  -----------------------------------------------------------------------
  Corporate Action                    Status
  ----------------------------------- -----------------------------------
  Dividend                            ✅ Complete for current
                                      entitlement/income scope

  Stock split                         ✅ Complete for current historical
                                      holding/replay scope

  Bonus shares                        ⬜ Not Started

  Merger                              ⬜ Not Started

  Other corporate actions             🔵 Deferred until a real
                                      requirement requires them
  -----------------------------------------------------------------------

Do not reopen Dividend or Stock Split simply because Performance or Tax
later consumes their data. A consuming feature should integrate with the
completed domain rather than reimplement it.

------------------------------------------------------------------------

# 32. Day-by-Day Development Tracking

  ------------------------------------------------------------------------
  Day                     Major Work               Result
  ----------------------- ------------------------ -----------------------
  Day 6                   Persistence, securities, Core persistence
                          listings, portfolios,    established
                          holdings                 

  Day 7                   Holding                  Holdings workflow
                          repository/service/API   established

  Day 8                   Transactions             BUY transaction
                                                   workflow established

  Day 9                   Transaction date         Historical transaction
                          filtering/index/order    querying improved

  Day 10                  Historical holdings and  Temporal domain
                          portfolio-history        established
                          queries                  

  Day 11                  Portfolio valuation and  Valuation introduced
                          market prices            

  Day 12                  Performance foundations, Performance foundations
                          FIFO semantics, test     established
                          isolation                

  Day 13                  Performance measurement  Return semantics
                          domain semantics         clarified

  Day 14                  Investment events and    Dividend workflow
                          dividends                implemented

  Day 15                  Stock split domain       Corporate-action
                                                   implementation started

  Day 16                  Stock split              Stock split completed
                          API/history/tests        

  Day 17                  Stock split/history      Baseline reached: 72
                          refinements and broader  tests passing
                          transaction tests        

  Day 18                  **To be selected from    Do not begin until next
                          this tracker**           incomplete requirement
                                                   is explicitly selected
  ------------------------------------------------------------------------

------------------------------------------------------------------------

# 33. Daily Development Protocol

At the beginning of each development day:

1.  Read this tracker.
2.  Confirm the previous day's final test status.
3.  Identify the highest-value incomplete or partial requirement.
4.  Confirm that it has not already been implemented.
5.  Define the smallest meaningful domain requirement.
6.  Write the first failing test.
7.  Implement the smallest production change.
8.  Run the relevant tests.
9.  Run the full test suite.
10. Update this tracker.
11. Record the day's completed milestone.
12. Explicitly close the day.

This protocol exists specifically to prevent feature duplication and
accidental reopening of completed work.

------------------------------------------------------------------------

# 34. Evidence Rules

A requirement should normally be marked **Complete** only when there is
evidence such as:

-   passing unit tests,
-   passing service/integration tests,
-   passing API tests,
-   migration/schema evidence where applicable,
-   or another explicit implementation artifact.

A discussion about a requirement is **not** implementation evidence.

A design decision is **not** implementation evidence.

A partially implemented service is **not** evidence that the complete
feature is finished.

------------------------------------------------------------------------

# 35. Decision Log

Use this section to record decisions that affect implementation status.

  ------------------------------------------------------------------------
  Date                    Decision                Impact
  ----------------------- ----------------------- ------------------------
  2026-10-08              Create a dedicated      Prevents
                          implementation tracker  roadmap/implementation
                          alongside the Master    ambiguity.
                          Requirements document.  

  2026-10-08              Treat Dividend and      Do not select them as
                          Stock Split as          new implementation work
                          completed domains for   merely because later
                          their currently defined features consume them.
                          scopes.                 

  2026-10-08              Day 18 must be selected Prevents premature or
                          from the tracker after  duplicate
                          reviewing               implementation.
                          incomplete/partial      
                          requirements.           
  ------------------------------------------------------------------------

------------------------------------------------------------------------

# 36. Next Development Selection

**Current status:** Day 18 has not yet been selected.

The next task must be chosen after reviewing the **🟡 Partial** and **⬜
Not Started** requirements and determining which one is the next real
requirement that meaningfully advances the platform.

The selection should answer:

> What investor-facing capability is next, and what new engineering
> problem does it force the system to solve?

Once selected, the requirement should be added to the Day 18 entry
before implementation begins.

------------------------------------------------------------------------

# 37. Relationship Between the Two Master Documents

## Master Requirements

Answers:

> **What should the platform eventually become?**

It contains product vision, domain requirements, future capabilities,
constraints, and engineering principles.

## Implementation & Requirements Tracking Master

Answers:

> **What have we actually built?**

It contains implementation status, evidence, partial areas, deferred
areas, day-by-day progress, and the next-development selection.

The two documents should evolve together but should **not be merged**.

This separation keeps the product roadmap stable while allowing
implementation status to change frequently.

------------------------------------------------------------------------

# 38. Maintenance Rule

Whenever a development task is completed:

-   update its status,
-   record the evidence,
-   record remaining scope if partial,
-   update the day-by-day history,
-   update the known partial areas if necessary,
-   and identify the next candidate requirement.

This tracker should be treated as a living engineering artifact, not as
a retrospective document.
