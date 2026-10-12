# Investment Platform — Master Requirements Update

**Update date:** October 12, 2026  
**Applies to:** `Investment_Platform_Master_Requirements_Draft_Updated.md`  
**Purpose:** Authoritative amendments to the master requirements. This update supersedes conflicting statements in the original document; it does not replace unrelated domain requirements.

---

## 1. Revised Product Direction

The platform is being developed web-first, while the intended user experience must be mobile-first. “Web-first” describes the initial delivery and development approach; it does not mean desktop-first design.

The initial client should be an efficient, responsive mobile web application that works well on small screens and constrained interaction contexts. A native mobile application remains a possible future client and should be considered when real user needs justify it.

The API and domain/service logic should remain sufficiently independent of the web UI to support a future native mobile client or other authorized API consumers without duplicating financial business rules.

## 2. Authentication and Authorization Are Now Prioritized Requirements

Authentication and authorization were not in scope for the earlier implementation stages. Their absence is therefore not a failure to meet the previous scope. They are now newly identified requirements because the product is intended to serve multiple users and may be shared with a pilot group.

The previous statement that authentication and authorization are intentionally outside the initial domain implementation is superseded by this update.

### 2.1 Authentication

The application must establish a trusted identity for each authenticated request. A user ID supplied in a request body, query parameter, or untrusted header must not by itself be treated as proof of identity.

The initial authentication mechanism must fit the browser-based web application while leaving a viable path for a future mobile client. The specific session/token approach is an implementation decision to make before coding, based on the expected clients and deployment model. Do not implement multiple mechanisms or an identity-provider framework prematurely.

### 2.2 Authorization

The first authorization requirement is ownership-based access control. A user must not be able to access or modify another user's portfolio or portfolio-owned investment data merely by knowing a resource ID.

This rule applies consistently to:

- Portfolio retrieval and creation.
- Current and historical holdings.
- Holding retrieval and creation.
- Transaction creation and direct transaction lookup.
- Portfolio transaction history and security-specific transaction queries.
- Historical holding quantities and quantity changes.
- Portfolio valuation and performance calculations.
- Dividend or other portfolio-specific information exposed through APIs.

The server must derive the requester identity from trusted authentication state and enforce ownership on every relevant access path. Direct holding and transaction lookups must be authorized through their parent portfolio. Request validation and resource-existence checks do not replace authorization.

The first release does not require generalized role-based access control. Do not introduce roles, permissions matrices, or a generic authorization framework unless a concrete requirement demands them.

### 2.3 Security and Test Invariants

- Unauthenticated requests to protected user/portfolio data are rejected.
- A user can access their own authorized portfolio data.
- A user cannot read or mutate another user's portfolio data, including through nested routes or direct resource IDs.
- Client-supplied owner IDs cannot override the authenticated identity.
- Authorization failures do not alter transactions, holdings, or other financial records.
- Existing financial-domain behavior remains unchanged except where necessary to enforce these invariants.

## 3. Mobile-First Web Requirements

The first user-facing web experience should:

- Use responsive layouts designed for narrow screens first.
- Keep essential portfolio summaries, holdings, transaction history, valuation, and performance information usable on mobile screens.
- Provide touch-friendly navigation and controls.
- Avoid requiring desktop-only tables or interactions for core workflows; use responsive tables, compact row/card layouts, or deliberate horizontal scrolling where appropriate.
- Keep forms, validation messages, and important financial values legible and usable on small screens.
- Avoid treating offline support or a native mobile application as a prerequisite for the initial responsive web experience.

A native mobile app, offline synchronization, and advanced device-specific capabilities remain future decisions informed by actual user needs.

## 4. Revised Near-Term Delivery Sequence

1. **Security requirements and route inventory:** document protected endpoints and establish ownership invariants.
2. **Authentication mechanism:** select and implement one appropriate initial mechanism for the browser-first product, with future mobile access in mind.
3. **Authorization enforcement:** protect portfolio, holding, transaction, valuation, and performance access paths.
4. **Security regression tests:** cover unauthenticated access, same-user access, cross-user denial, and denied writes without side effects.
5. **Responsive web client:** build the initial mobile-first interface on the secured API.
6. **Pilot readiness:** review onboarding, data entry/import needs, deployment, backups, and operational safeguards before sharing with pilot users.

Implementation remains incremental. First secure the API boundary; do not begin by building a broad identity platform or an elaborate permissions framework.

## 5. Architecture Principle

Web-first development and mobile-first design are compatible. The first client is a responsive web application; domain rules remain in the API/service layer; authentication establishes identity; authorization protects user-owned resources. A future native client should reuse the same business rules and enforce the same authorization invariants.
