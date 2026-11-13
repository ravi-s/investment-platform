# Personal Investment & Portfolio Platform — Master Requirements Amendment

**Amendment date:** November 13, 2026  
**Project checkpoint:** Day 33 — registration and backend authentication lifecycle verified; frontend authentication state remains next  
**Companion tracker:** `Implementation_Tracker_Amendment_2026-11-13.md`  
**Supersedes checkpoint:** November 7, 2026 (Day 31)  
**Purpose:** Supplement the existing master requirements with the Day 33 authentication milestone and a planned password-policy requirement. This amendment does not replace the master requirements or earlier amendments.

## 1. Authentication — Day 33 verified capability

The backend authentication lifecycle has been exercised end to end:

- User registration through `POST /api/users`.
- Duplicate email registration returns HTTP `409` with a useful error message.
- Successful login creates a server-side session and issues an HttpOnly session cookie.
- `GET /api/auth/me` returns the authenticated user when a valid session cookie is supplied.
- Logout revokes the server-side session; a subsequent `/api/auth/me` request returns HTTP `401`.

The frontend now includes registration and login pages, registration API integration, success/error feedback, navigation between the pages, and the `/register` route. Successful registration and duplicate-email handling were verified through the browser. Frontend authentication state, session restoration on application startup, protected-route behavior, and UI logout remain future work.

## 2. Planned security requirement — password policy

The application shall enforce a clear, server-side password policy to reduce the risk of weak or easily guessed account passwords. This is a planned security requirement; implementation is not part of the Day 33 completion and is not urgent relative to the current frontend authentication work.

The policy shall be applied consistently wherever a password is created or changed, including registration and any future password-change or password-reset flows. The detailed thresholds and validation behavior must be agreed before implementation.

The policy design should address:

- A suitable minimum password length and a generous maximum accepted length; do not silently truncate passwords.
- Support for long passphrases, spaces, and password-manager-generated passwords.
- Blocking commonly used, known-compromised, or otherwise unacceptable passwords using an appropriate blocklist.
- Avoiding arbitrary character-composition rules that add friction without meaningfully improving password strength.
- Avoiding routine forced password changes unless there is evidence of compromise or another security reason.
- Allowing password managers, autofill, and paste operations.
- Clear, accessible validation feedback in the UI, with authoritative validation on the backend.
- Appropriate login-attempt throttling/rate limiting as a complementary authentication control; this is related but distinct from password composition policy.
- Secure password reset/change handling when those workflows are introduced, including appropriate session invalidation or rotation.

Existing password hashing with Argon2id remains required. Passwords and password hashes must never be returned in API responses or written to application logs.

**Status:** Planned / not implemented. Decide the concrete policy and acceptance criteria before implementation. Do not treat this item as a blocker for the current frontend authentication-state increment.

## 3. Continuing guardrails

- Preserve the RED → GREEN → REFACTOR workflow.
- Keep backend authentication and authorization enforcement authoritative; frontend route protection is a user-experience boundary, not a substitute for API authorization.
- Keep GitHub as the canonical source for code and synchronize checked-in project documentation with the implementation checkpoint.
