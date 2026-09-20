# AI Project Change Log

## 2026-09-20 — Fixing empty bearer token headers

- **Task:** Fix authenticated profile requests sending an empty bearer token.
- **Files changed:** Planned: `src/components/Profile.jsx`, `src/components/MenteeDashboard.jsx`, `CHANGELOG_AI.md`
- **Exact type of change:** Authentication bug fix
- **What changed:** `Profile.jsx` now sends the current Supabase access token in its bearer header, and `MenteeDashboard.jsx` sends the session token it already retrieved.
- **Why it changed:** Both components obtain the current Supabase access token but currently omit it from the `Authorization` header.
- **Tests/checks performed:** Frontend build and source verification completed after implementation.
- **Result:** Empty bearer headers fixed.
- **Remaining issue:** Live `/profile` verification still requires configured Supabase/backend services.
- **Manual Supabase steps:** None.

## 2026-09-20 — Fixing Supabase browser authentication sessions

- **Task:** Fix missing Supabase browser sessions after login/register and make protected profile requests use the current session.
- **Files changed:** Planned: `src/components/Auth.jsx`, `src/components/MenteeDashboard.jsx`, `src/components/MenteeRequirements.jsx`, `src/components/Profile.jsx`, `backend/src/routes/auth.js`, `CHANGELOG_AI.md`
- **Exact type of change:** Authentication bug fix
- **What changed:** Login guards the backend session response, establishes and verifies the Supabase browser session, and routes using the backend response role. Registration safely handles session: null by asking the user to confirm their email. Dashboard, requirements, and profile requests use the current Supabase session bearer token; logout signs out through Supabase and verifies the session is cleared. No access or refresh tokens are logged.
- **Why it changed:** Login/register currently assume a session exists, protected request headers are malformed, and role/session handling can leave the browser unauthenticated or route users incorrectly.
- **Tests/checks performed:** `npm run build` passed. `node --check backend/src/routes/auth.js` and `node --check backend/src/middleware/authMiddleware.js` passed. Source search confirmed no stale `localStorage` access-token reads/writes or token logging in the changed auth surfaces. Live login, `/profile` 200, profile update, embedding generation, logout, and email-confirmation flows were not run because they require configured Supabase/backend/AI services.
- **Result:** Authentication changes implemented and frontend/backend syntax validation passed.
- **Remaining issue:** Live end-to-end verification still requires running the configured backend, Supabase project, and AI embedding service.
- **Manual Supabase steps:** After implementation, verify `http://localhost:5173` is included in Supabase Authentication URL Configuration as the Site URL or an allowed redirect URL. This will not be changed from code.

## 2026-09-20 — Change log initialization

- **Task:** Establish the required project change log before any code changes.
- **Files changed:** `CHANGELOG_AI.md`
- **Exact type of change:** Added
- **Planned change:** Create `CHANGELOG_AI.md` with chronological, newest-first entries and fields for every future project change.
- **Actual result:** Created this file with the required logging policy and this initial entry. No code, dependency, database/schema, or environment configuration files were modified.
- **What changed:** Login guards the backend session response, establishes and verifies the Supabase browser session, and routes using the backend response role. Registration safely handles session: null by asking the user to confirm their email. Dashboard, requirements, and profile requests use the current Supabase session bearer token; logout signs out through Supabase and verifies the session is cleared. No access or refresh tokens are logged.
- **Why it changed:** To ensure every subsequent file, configuration, dependency, database/schema, or environment-related change is recorded before and after implementation.
- **Tests/checks performed:** Confirmed the current branch is `shravani`; confirmed `CHANGELOG_AI.md` did not previously exist; checked the worktree before and after the operation.
- **Result:** Change log initialized successfully.
- **Remaining issue:** Existing pre-task worktree changes remain present and were not modified.
