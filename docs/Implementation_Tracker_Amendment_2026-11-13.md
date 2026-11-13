# Personal Investment & Portfolio Platform — Implementation Tracker Amendment

**Amendment date:** November 13, 2026  
**Development checkpoint:** Day 33 — registration and backend authentication lifecycle verified  
**Companion requirements:** `Master_Requirements_Amendment_2026-11-13.md`  
**Supersedes checkpoint:** November 7, 2026 (Day 31)  
**Purpose:** Carry forward the existing project status, record Day 33 outcomes, add the planned password-policy requirement, and establish the next frontend authentication increment.

## 1. Day 33 — completed work

### Registration frontend

- Created the registration page with name, email, and password fields.
- Added `register()` to the existing authentication service, calling `POST /api/users`.
- Added submission state and success/error feedback.
- Verified successful registration through the browser.
- Verified duplicate email handling: backend returns HTTP `409` and the frontend displays `An account with this email already exists`.
- Added navigation links between Login and Registration.
- Added the `/register` route under the existing `MainLayout` route structure.
- Verified the Vite `/api` proxy forwards requests to the Fastify backend on port `3001`.
- Frontend build passed after the changes.

### Backend authentication lifecycle verification

Using `curl` with a cookie jar:

- Login succeeded and issued a session cookie.
- `GET /api/auth/me` with the saved cookie returned HTTP `200` and the authenticated user.
- Logout was invoked with the session cookie.
- A subsequent `GET /api/auth/me` returned HTTP `401` with `Authentication required`, confirming server-side session invalidation.

These are developer-observed integration results from Day 33; they were not independently rerun while preparing this amendment.

### Test/build baseline

- Latest previously reported backend regression baseline: **282 tests passed across 27 test files**.
- Day 33 frontend builds passed after registration UI, service integration, navigation, and route changes.
- No new full backend regression count was reported for Day 33; do not record 282 as a newly rerun Day 33 result.

**Day 33 is COMPLETE.**

## 2. Authentication capability status

| Capability | Status | Evidence / next action |
|---|---|---|
| User registration API | ✅ Implemented | `POST /api/users`; atomic user/credential persistence and Argon2id hashing. |
| Duplicate email handling | ✅ Implemented and verified | HTTP `409`; frontend displays backend message. |
| Registration page | ✅ Implemented | Name, email, password; success/error and submitting states. |
| Registration service integration | ✅ Implemented | `register()` calls `/api/users`. |
| Login page and API service | ✅ Implemented | Existing login page calls `POST /api/auth/login`. |
| Login/Register navigation | ✅ Implemented | React Router links between `/login` and `/register`. |
| Registration route | ✅ Implemented | `/register` nested under `MainLayout`. |
| Vite API proxy | ✅ Configured and verified | `/api` forwards to Fastify at `http://localhost:3001`. |
| Backend login/session creation | ✅ Verified | Login returned user and set session cookie. |
| Authenticated session lookup | ✅ Verified | `/api/auth/me` returned HTTP `200` with the user. |
| Logout/session revocation | ✅ Verified | Subsequent `/api/auth/me` returned HTTP `401`. |
| Application-level auth state | ⬜ Not implemented | Create authentication context/provider. |
| Session restoration on app startup | ⬜ Not implemented | Load current user through `/api/auth/me`. |
| Login updates shared auth state | ⬜ Not implemented | Integrate login success with provider. |
| Protected frontend routes | ⬜ Not implemented | Add route guard for authenticated areas such as `/portfolios`. Backend authorization remains authoritative. |
| Frontend logout workflow | ⬜ Not implemented | Call logout API, clear shared state, and navigate appropriately. |
| Password policy | 🟡 Planned; not urgent | Define and enforce a consistent server-side policy for registration and future password change/reset. See requirements amendment. |
| Password change/reset workflows | ⏸ Future work | Define secure recovery and session behavior when prioritized. |
| Login-attempt rate limiting | 🟡 Security requirement to assess | Complement password policy; decide scope and thresholds before implementation. |

## 3. Next development increment — Day 34

**Goal:** Introduce application-level authentication state in the React frontend.

Proposed sequence:

1. Inspect the current frontend app entry point, routing, and layout files before changing them.
2. Create an authentication context/provider with a typed authenticated-user state and loading state.
3. On application startup, call `/api/auth/me` to restore an existing session; handle `401` as an unauthenticated state.
4. Update shared authentication state after successful login.
5. Add a protected-route boundary for authenticated pages such as `/portfolios`.
6. Implement frontend logout by calling the backend logout endpoint, clearing shared state, and navigating to Login.
7. Test authenticated, unauthenticated, refresh, and logout flows incrementally; run the frontend build and relevant backend regression tests as appropriate.

Maintain the project's incremental approach: inspect current files first, make one focused change at a time, and avoid introducing unnecessary state-management libraries.

## 4. Deferred security requirement — password policy

**Priority:** Planned, non-urgent. Track in requirements; do not interrupt the Day 34 authentication-state work to implement it.

Before implementation, agree on concrete acceptance criteria covering:

- Minimum and maximum password length; no silent truncation.
- Long passphrase and password-manager support, including paste/autofill.
- Blocklist checks for common and known-compromised passwords.
- No arbitrary composition rules unless a clear security rationale is established.
- No routine forced rotation absent compromise or another security reason.
- Consistent backend enforcement for registration and future password change/reset flows.
- Clear frontend validation feedback; backend remains authoritative.
- Related login-attempt throttling/rate limiting.
- Secure password reset/change and appropriate session invalidation when those flows are introduced.
- Continued use of Argon2id; never expose or log passwords or password hashes.

The exact numeric thresholds and blocklist approach remain decisions for the policy-design task; they are intentionally not fixed in this tracker amendment.

## 5. Working guardrails

- Maintain RED → GREEN → REFACTOR.
- Inspect the current project files before editing; uploaded latest files take precedence over older Library snapshots.
- Backend authorization remains mandatory even after frontend route guards are added.
- Keep the implementation cost-effective and avoid adding a state-management dependency without demonstrated need.
- GitHub remains the canonical source for code; commit the documentation amendments alongside the project checkpoint.
