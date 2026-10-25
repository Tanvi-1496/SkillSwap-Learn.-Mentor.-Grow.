# AI Project Change Log

## 2026-09-20 — Phase 2: real AI recommendation bridge + AIRecommendations wiring

- **Task:** Phase 2. (1) Add a Node/Express bridge from React to the existing FastAPI recommendation endpoint. (2) Replace the hardcoded mentor data in `AIRecommendations.jsx` with real recommendations.
- **Files changed:** `backend/src/routes/recommendations.js` (new), `backend/src/services/aiService.js`, `backend/src/server.js`, `src/components/AIRecommendations.jsx`, `CHANGELOG_AI.md`
- **Exact type of change:** Feature wiring (no algorithm change)
- **What changed:**
  1. `aiService.js` gained `fetchRecommendations(studentId)`, following the existing `generateProfileEmbedding` pattern: same `AI_SERVICE_URL` env var, same non-OK-to-thrown-Error handling.
  2. New `GET /recommendations` route, protected by `authMiddleware`. The student ID is taken from `req.user.id` on the verified Supabase session and is never read from the query string or body, so a caller cannot request another user's recommendations. AI service failures are logged server-side and returned to the client as a generic 503 so FastAPI internals and URLs are not leaked. Mentor names are attached from the existing `users` table (`id, name`) and the payload is reshaped into a flat `recommendations[]` with a nested `scores` object. A name-lookup failure degrades to a null name rather than failing the request.
  3. `server.js` mounts the route at `/recommendations`.
  4. `AIRecommendations.jsx` now reads the Supabase session, calls `GET /recommendations` with a bearer token, and renders the real Top 3. Added explicit loading, error, empty and success states. Fields rendered from real data: name, mentor type, skills, experience, organization, verified flag, overall score, semantic similarity, goal match, rating and availability.
- **Why it changed:** The FastAPI recommendation endpoint and its scoring logic were already complete but had no caller — no Express route and no frontend consumer — so the AI system was unreachable from the app.
- **Explicitly NOT changed:** `ai/aiml/api/main.py` was not touched. The SBERT model (`all-MiniLM-L6-v2`), the scoring weights (0.60 / 0.15 / 0.10 / 0.10 / 0.05), the `match_mentors` pgvector RPC, the RF model and the database schema are all untouched. Mentor names are resolved in Node rather than in FastAPI precisely to avoid editing the verified AI service.
- **Mock data removed from `AIRecommendations.jsx`:** the four fabricated mentors; the "Your Requirement Profile" summary panel (fabricated student skills/goal/experience/preferred time — `GET /profile` does not currently return these fields, so it could not be populated truthfully); the invented per-mentor "workload" bar; the invented session counts; and the hand-written "why this mentor" marketing prose, replaced by a factual breakdown of the actual component scores returned by the AI service.
- **Mock data deliberately LEFT in place:** the filter and sort dropdowns are still non-functional, exactly as before this change. They were not wired up because filtering is out of Phase 2 scope. The static "How Our AI Recommends Mentors" architecture panel was kept as design content and its labels corrected to match the real pipeline.
- **Tests/checks performed:** `npm run build` (via `node node_modules/vite/bin/vite.js build`) PASSED — 73 modules transformed, built in 9.31s. `node --check` passes on all eight backend files including the new route. `AIRecommendations.jsx` and the other auth-surface components parse cleanly via the TypeScript JSX parser. `git diff --check` reports only pre-existing CRLF trailing-whitespace warnings repo-wide (untouched `backend/src/routes/auth.js` alone produces 184 of them); the new route file contains zero trailing whitespace. Live testing (login → dashboard → AI Recommendations → Node → FastAPI → Top 3) was NOT run: it requires the running Express server, the running FastAPI service and the configured Supabase project, none of which are available in this environment.
- **Result:** The recommendation path is wired end to end in code. Not yet confirmed against live services.
- **Remaining issue:** "View Profile" and "Book Session" still navigate without passing the mentor ID, so `MentorProfile.jsx` keeps using its hardcoded UUID until Phase 3. Rating is rendered from the AI service's normalised `rating_score` (score × 5); it will read "Not rated yet" until the `reviews` table has rows in Phase 6.
- **Manual Supabase steps:** None. No schema change was made.

## 2026-09-20 — Phase 1: authentication + student profile save

- **Task:** Phase 1 (Authentication + Profile). Verify register/login/logout, verify authorized requests send a real Supabase access token, and ensure the student profile can actually be saved.
- **Files changed:** `src/components/MenteeRequirements.jsx`, `src/components/MenteeDashboard.jsx`, `CHANGELOG_AI.md`
- **Exact type of change:** Authentication bug fix + error handling
- **What changed:**
  1. `MenteeRequirements.jsx` now sends `Bearer ${token}` on `PUT /profile`. It previously retrieved the session token and then sent a literal empty `Bearer ` header, so every profile save was rejected with 401.
  2. `MenteeDashboard.jsx` profile fetch was converted from an unguarded promise chain to `await` inside try/catch, with a `response.ok` check. A failed or rejected profile request previously produced an unhandled rejection and left the dashboard silently blank. The `console.log` of the full profile payload was removed.
- **Why it changed:** The empty bearer header blocked the entire Phase 1.3 path. Because the save never reached the backend, no `student_profiles` row was written and `generateProfileEmbedding` was never invoked, which in turn left AI recommendations with no student embedding to match against.
- **Not changed (verified correct, left alone):** `Auth.jsx` register/login/logout, session establishment and role routing; `Profile.jsx` bearer header; `backend/src/routes/profile.js` `PUT /` (already persists department, semester, skills, career goal, learning requirement and level, then updates the SBERT embedding); `backend/src/middleware/authMiddleware.js`.
- **Tests/checks performed:** Changed and adjacent auth files (`MenteeRequirements.jsx`, `MenteeDashboard.jsx`, `Profile.jsx`, `Auth.jsx`) parse cleanly via the TypeScript JSX parser. `node --check` passes on all seven backend files. Source audit confirms no remaining empty bearer headers, no access/refresh token logging, and no `localStorage` token reads or writes. `npm run build` could NOT be run in this environment: the supplied `node_modules` holds Windows rolldown bindings, so `vite build` fails with a missing `@rolldown/binding-linux-x64-gnu`. This is an environment limitation, not a code defect. Live login, `PUT /profile` 200, embedding generation and logout were not executed because they require the running backend, FastAPI service and configured Supabase project.
- **Result:** Profile save path unblocked; dashboard profile failures are now surfaced instead of swallowed.
- **Remaining issue:** `npm run build` must be re-run on the Windows machine to confirm. `MenteeRequirements.jsx` still collects `cgpa` and `preferredMentor` but sends neither, and the backend accepts neither — both are unpersisted and need a schema decision before Phase 7. `Profile.jsx` remains read-only and its Back button uses `window.history.back()`, which does nothing under the app's state-based navigation.
- **Manual Supabase steps:** None from code. Backend still queries Supabase with the publishable/anon key without forwarding the user JWT, so `auth.uid()` is null for backend writes; confirm RLS on `users` and `student_profiles` permits the `PUT /profile` update before treating Phase 1 as verified.

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