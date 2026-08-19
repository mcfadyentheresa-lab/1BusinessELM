# ELM (Elevated Living Management) — Codebase Audit

**Scope note:** This audit was originally scoped as an Elm-lang review (elm.json,
elm-format, elm-test, The Elm Architecture, ports). The app is actually **React 18 +
TypeScript + Vite**, client-routed with **wouter**, styled with **Tailwind + shadcn/ui
(Radix primitives)**, state via **Zustand + TanStack Query**, backed by **Supabase**
(Postgres, RLS, Auth, Storage, Edge Functions on Deno). There is no `.elm` file or
`elm.json` anywhere in the repo. This report keeps the original 7-hat structure but
translates each question to its real equivalent in this stack. This is a read-only
analysis — **no files were modified, formatted, or refactored.**

Repo: `github.com/mcfadyentheresa-lab/1BusinessELM` — 99 commits, 2026-06-20 to
2026-08-03 (~6.5 weeks old), 95 commits from a single human author
(`mcfadyentheresa-lab`) plus 6 automated commits from `railway-app[bot]` fixing
deploy config. 5 branches: `main` + 4 `railway/*` deploy-fix branches. No CI
workflows (`.github/` does not exist).

---

## 1. Software Architect

### Structure today
```
src/
  App.tsx              — route table + auth/role gating (one file, ~150 lines, clean)
  components/
    board/              — 18 files, the "planning board" (mood board / canvas) feature
    layout/AppShell.tsx  — nav shell
    ui/                  — ~25 shadcn/ui primitives (button, dialog, tabs, etc.)
  contexts/view-as.tsx   — "view as role" admin preview context
  hooks/                 — 9 hooks (auth, presence, projects, realtime, upload...)
  lib/                   — supabase client, canvas-api, mappers, digest, utils
  pages/                 — 22 route-level page components
  services/elmSyncService.ts
  shared/{routes.ts, database.types.ts} — API path table + generated DB types
  stores/canvas-store.ts — Zustand store for the board
```
Total: ~31,470 lines across `src/**/*.{ts,tsx}`.

### Is there a "giant Main.elm"?
Yes — one component plays that role: **`src/components/board/PlanningBoard.tsx`
is 9,942 lines**, roughly a third of the entire application's TypeScript, in a
single file. Evidence of the internal sprawl:
- **97 `useState` calls** in this one file (next closest is `SupplierPrices.tsx`
  at 26 — see `grep -c useState`).
- **23 `useEffect` calls**.
- Only 20 top-level `function`/`const` declarations for ~10K lines, meaning most
  logic lives as closures nested inside one giant component body rather than
  extracted helpers.
- 55 imports at the top of the file — it pulls in nearly every drawer/dialog/panel
  in `components/board/` (`MaterialsDrawer`, `PhotosDrawer`, `HardwarePickerDialog`,
  `RoomRenderDialog`, `PaletteExtractionDialog`, `CanvasConnectors`, etc.), making
  it the de facto orchestrator for the entire feature.

This is exactly the "one giant Model/Msg" anti-pattern the original brief asked
about, just manifesting as one giant `useState`/`useEffect` bag instead of a
giant Elm `Msg` union. The rest of the app does **not** have this problem —
pages like `Dashboard.tsx` (556 lines), `CrewDashboard.tsx` (314), `MasterCalendar.tsx`
(302) are reasonably scoped per-route, each with local `useState`/hooks rather than
shared global state.

### Separation of concerns
- **Routing/access control**: cleanly isolated in `App.tsx` — a single `RoleGuard`
  wrapper component (lines 15–28) does role-based route gating, `OnboardingGuard`
  handles first-login redirect, and role-to-dashboard mapping is a 6-line
  `HomeDashboard` component. This part is genuinely tidy.
- **Domain/data layer**: `src/shared/routes.ts` centralizes a typed REST-style API
  path table (`api.projects.list`, `api.planningBoards.saveCanvas`, etc.) — good
  practice, single source of truth for endpoints, even though most actual data
  access goes through the Supabase JS client directly rather than this table (it's
  unclear whether `routes.ts` is fully wired up or a legacy/parallel scheme — worth
  checking whether it's dead weight, see §6).
- **State management**: split awkwardly between three mechanisms — React local
  state (`useState`, dominant), TanStack Query (`hooks/use-projects.ts`,
  `use-recent-projects.ts`), and a single Zustand store (`stores/canvas-store.ts`)
  used only by the board feature. There's no documented rule for when to use which;
  in practice it looks like "board feature gets Zustand, everything else gets
  ad hoc `useState` + Query," which is a reasonable de facto boundary but isn't
  written down anywhere.
- **"Ports" equivalent (JS/external interop)**: Supabase client (`lib/supabase.ts`),
  Edge Functions (`supabase/functions/*`, 8 of them), and browser APIs used directly
  in components (drag/drop, clipboard, canvas). There's no consistent adapter layer
  — components call `supabase.from(...)` directly in many places rather than going
  through `hooks/` or `lib/` wrappers, meaning the Supabase schema shape leaks into
  UI components. `use-auth.ts` and `use-projects.ts` do wrap this properly; many
  page components don't.

### Seams / natural decomposition points
- **Planning Board** (`components/board/*`, `stores/canvas-store.ts`,
  `lib/canvas-api.ts`, `lib/board-*.ts`) is already the most self-contained feature
  — it has its own store, its own migration files (`04_planning_boards.sql`,
  `create_board_snapshots.sql`), its own Edge Function (`board-prompt`). This is
  the cleanest candidate for extraction if that's ever wanted, modulo the fact that
  the entry component itself is a monolith internally (see above).
- **Cost Estimating** (`CostEstimator.tsx`, `EstimatesList.tsx`,
  `SupplierPrices.tsx`, Edge Functions `estimate-generator`, `estimate-auditor`,
  `estimate-client-reviewer`) is the second most self-contained cluster, with its
  own migration files (`05_cost_estimator.sql`, `pricing_book_schema.sql`,
  `seed_assemblies_and_coverage.sql`).
- **Crew/Ops** (`CrewDashboard.tsx`, `CrewAndTrade.tsx`, `Timesheets.tsx`,
  `Payroll.tsx`, `MasterCalendar.tsx`) shares role-gating logic but otherwise
  touches mostly disjoint tables.
- These three areas rarely import from each other directly — the coupling that
  exists is mostly through shared infrastructure (`use-auth`, `AppShell`,
  `database.types.ts`), not direct cross-feature imports. That's a healthy sign
  for a future "modular monolith" reorganization (see §7).

### Circular/awkward dependencies
No import cycles found via manual inspection of `components/board` ↔ `pages` ↔
`hooks`. The one structurally awkward thing: `src/shared/routes.ts` defines a full
REST API surface (projects, tasks, milestones, photos, decisions, selections,
change orders, site visits, time entries, checklist, board, calendar, reports,
weather...) that doesn't obviously correspond 1:1 to what's actually called against
Supabase elsewhere in the code — this looks like it may be a holdover from an
earlier or parallel backend design. Worth a follow-up grep to confirm it's fully
live before trusting it as documentation of the API surface.

---

## 2. Engineer / Code Quality

### Type safety
- `tsconfig.app.json` has `"strict": true` — good baseline. But
  `"noUnusedLocals": false` and `"noUnusedParameters": false` are explicitly
  disabled, which means dead variables/parameters accumulate silently instead of
  surfacing at compile time.
- **245 occurrences** of `: any`, `<any>`, or `as any` across `src/`. This is a
  significant amount of type-safety opt-out for a strict-mode codebase.
- **176 occurrences** of `as SomeType` casts (excluding `as const`) — i.e., the
  code frequently tells the compiler to trust a shape rather than validating it.
  Example: `supabase/functions/parse-receipt/index.ts:35` —
  `const role = (profile as any)?.role ?? ...` — casts through `any` rather than
  using the generated `Database` types already available in
  `src/shared/database.types.ts`.
- **No runtime validation library** (no zod/yup/io-ts in `package.json` or
  imports). This matters directly for the "decode failures" question in §5 below
  — the app has no equivalent of Elm's `Json.Decode` failure path. Supabase
  responses and `req.json()` bodies in Edge Functions are trusted via TypeScript
  types alone, which provide zero runtime protection.

### "Impossible states" / custom types
- Role modeling is a **bare string** (`"admin" | "crew" | "client"` inferred from
  usage, not a shared enum/union type defined once) — used inline in `App.tsx`'s
  `allowedRoles={["admin", "crew"]}` arrays, in RLS SQL as string literals, and in
  `use-auth.ts`. There's no single exported `type Role = "admin" | "crew" |
  "client"` that all these sites import, so a typo in any one of them (e.g.
  `"cliente"`) would silently fail role checks rather than fail to compile.
- No evidence of opaque types or branded/nominal types (e.g., distinguishing a
  `ProjectId` from a `UserId`, both of which are plain `string` UUIDs throughout).
  Given how many `:id`/`:projectId`/`:boardId` route params and function args
  exist in `shared/routes.ts` and the page components, a mixed-up ID passed to
  the wrong function would not be caught by the type checker.

### Effect management
- No ports in the Elm sense; the closest equivalent (Supabase realtime
  subscriptions, presence heartbeats) lives in `hooks/use-board-realtime.ts` and
  `hooks/use-presence.ts`, each scoped to one concern — reasonably clean.
- Cleanup hygiene is inconsistent: `hooks/use-body-pointer-events-cleanup.ts`
  exists specifically to patch up a leaked global side effect (pointer-events
  stuck on `<body>`), suggesting at least one prior bug class here; worth
  checking whether `PlanningBoard.tsx`'s many `useEffect`s (23 of them) all have
  matching cleanup functions, since with that much local state, a missed
  cleanup is easy to introduce and hard to spot in review.

### Dead code / dependencies
- `elm.json` doesn't exist (not applicable); dependency hygiene was checked via
  `npm outdated` against `package.json`:
  - **`lucide-react` 0.475.0 → latest 1.32.0** (major version behind).
  - **`tailwind-merge` 2.6.1 → latest 3.6.0** (major version behind).
  - **React 18.3.1 → latest 19.2.8** — a full major behind; not urgent but worth
    tracking, especially since some `@radix-ui/*` packages are already shipping
    React-19-era releases.
  - Everything else in `dependencies` is within its declared semver range and
    current.
- `npm audit` reports **4 high-severity transitive vulnerabilities**: `nanoid`,
  `postcss`, `fast-uri`, `brace-expansion` — all listed as fixable via
  `npm audit fix` (i.e., they're transitive, pulled in by build tooling, not
  direct app-security-relevant, but should be patched).
- `src/shared/routes.ts` (see §1) is a candidate for dead code — it defines a
  large REST surface that may not be fully wired to real network calls if the
  app talks to Supabase directly elsewhere.

### Testing
- **Zero test files** in the entire repository — no `*.test.*`, no `*.spec.*`,
  no test runner configured in `package.json` (no vitest/jest dependency, no
  `test` script). This is the single biggest gap in the "Elm-test equivalent"
  category: there is no automated safety net at all.
- Highest-risk untested surface, by both size and blast radius:
  1. `PlanningBoard.tsx` (9,942 lines, 97 pieces of state) — any regression here
     is currently only caught by manual clicking.
  2. `CostEstimator.tsx` (1,444 lines) — money math with no tests.
  3. The Supabase Edge Functions (`estimate-generator`, `estimate-auditor`,
     `parse-receipt`, etc.) — these call external AI APIs and have zero test
     coverage of their request/response contracts.

### Performance smells
- `PlanningBoard.tsx`'s 97-piece state surface inside one component is a strong
  candidate for excessive re-renders — any single state update potentially
  re-renders the entire board tree unless carefully memoized. Spot-checking is
  needed to confirm actual `React.memo`/`useMemo` usage there, but a component
  of this size with this much local state is a classic re-render hotspot.
- No obvious N+1 query patterns were found in a surface read of `use-projects.ts`,
  but the direct `supabase.from(...)` calls scattered through page components
  (rather than centralized through hooks) make it hard to audit this
  systematically — each page could independently be over-fetching.

---

## 3. Designer / UX

### Design system
There **is** a real token system, not ad hoc styling — this is a positive
finding. `src/index.css` defines a full set of HSL custom properties
(`--background`, `--primary`, `--card`, `--sidebar`, `--chart-1..5`,
`--status-online`, etc.), and `tailwind.config.js` maps Tailwind's color/radius
scale onto those tokens (`hsl(var(--primary) / <alpha-value>)`). Components are
built on shadcn/ui primitives in `src/components/ui/` (button, dialog, tabs,
tooltip, etc.), which enforces a consistent base. Dark mode is wired via
`next-themes` (`ThemeProvider attribute="class"` in `App.tsx`) and
`darkMode: ["class"]` in the Tailwind config, though `defaultTheme="light"` — it's
unclear how much of the app has actually been visually verified in dark mode
given the amount of hand-rolled Tailwind class strings per component.

### Accessibility
- **`aria-*` attributes**: 88 uses across `src/**/*.tsx` — present but not dense
  for an app this size (31K lines).
- **`alt` text**: all 38 real `<img>` elements in the codebase have an `alt`
  attribute (verified by parsing full multi-line JSX tags, not just single-line
  grep — an easy false positive to avoid). This is good hygiene.
- **Semantic HTML is thin**: only 1 `<main>`, 0 `<nav>`, 4 `<header>`, 3
  `<footer>`, 2 `<section>`, 0 `<article>` across the whole app, against **1,286**
  raw `<div>` elements. `AppShell.tsx` (the primary navigation shell) does not use
  a `<nav>` landmark, which matters for screen-reader users trying to jump to
  navigation.
- **Keyboard accessibility**: found **10 instances of `<div ... onClick`**
  (clickable divs without a native interactive role), in:
  `AppShell.tsx:287`, `ColorPortfolio.tsx:110` and `:114`,
  `CompareDrawer.tsx:314`, `FurnitureSidePanel.tsx:131`, and 5 inside
  `PlanningBoard.tsx` (5046, 5423, 7737, 7797, 8725). The `PlanningBoard.tsx`
  ones are plausibly canvas/drag-surface interactions where a `<div>` is
  defensible, but `AppShell.tsx:287` and `ColorPortfolio.tsx` are standard nav/
  UI elements that should likely be `<button>` or have `role="button"` +
  `tabIndex={0}` + keydown handling to be keyboard-operable.
- No `eslint-plugin-jsx-a11y` in the ESLint config (`eslint.config.js`) — nothing
  currently catches these patterns automatically going forward.

### Responsive behavior
Not independently verified in-browser as part of this static audit (no dev
server was run for this pass) — flagged as an open question rather than a
finding. Given Tailwind's utility classes are used throughout, responsive
breakpoints are at least *possible* per-component, but whether they're
consistently applied wasn't verified.

### UX friction / missing states
- Loading state: `App.tsx`'s `RouteFallback` (a centered spinner) covers
  route-level lazy-loading, which is good coverage for the top-level case.
- Error state: **no error boundary exists anywhere in the codebase** (confirmed:
  no `componentDidCatch`, no `ErrorBoundary` component). A thrown render error
  in any page — including the 9,942-line `PlanningBoard.tsx` — will produce a
  blank white screen with no recovery UI, rather than a contained error message.
- Empty/error states inside data views were not exhaustively catalogued in this
  pass; given the volume of direct `supabase.from()` calls in page components
  (§2), it's likely inconsistent page-to-page whether a failed fetch shows a
  message, a spinner forever, or nothing.

---

## 4. DevEx / Build & Tooling Engineer

### Build setup
- Vite + `tsc -b` for typechecking, standard and current for this stack
  (`vite.config.ts` is a minimal 15-line React plugin config — not bloated).
- `package.json` scripts: `dev`, `build`, `lint`, `preview`, `start`
  (`npx serve -s dist -l ${PORT:-3000}`). The `start` script and its `serve`
  dependency exist specifically because of Railway deployment — see below.
- No test script, no format script (no Prettier config file found anywhere in
  the repo root).

### CI/CD — actual deploy mechanism found
- **There is no GitHub Actions setup** (`.github/` doesn't exist) despite the
  repo being on GitHub.
- Git history reveals the real deploy pipeline is **Railway**, evidenced by:
  - 6 automated commits from `railway-app[bot]` on branches named
    `railway/fix-deploy-*` and `railway/code-change-*` (e.g. commit `a84a84d`:
    *"fix: add serve dependency and npm start script for Railway deployment"*,
    later followed by `8b97f3e`: *"fix: remove serve devDependency and start
    script from package.json"* — i.e., Railway's own bot added and then reverted
    its own fix, a sign of some deploy-config churn/flakiness worth checking on
    Railway's dashboard directly).
  - No `netlify.toml` or `railway.json`/`railway.toml` committed to the repo —
    deploy configuration for whichever platform is actually live appears to be
    managed entirely through that platform's dashboard UI rather than
    version-controlled, so it isn't visible or auditable from the codebase alone.
  - **Worth flagging directly**: you mentioned this app is "attached to Netlify
    and GitHub," but the only deploy automation evidence found in the repo
    points to **Railway**, not Netlify. Worth double-checking which platform is
    actually serving `project.asterandspruceliving.ca` in production — it's
    possible both were tried at different points, or one is stale.
  - **Resolved (2026-08-18)**: neither guess above was right. The Railway
    project connected to this repo is stale/abandoned (deployment history
    shows "REMOVED" entries, no active deployment) — the `railway-app[bot]`
    commits above are historical, not evidence of the current pipeline.
    Production is actually served by **Bolt.new's own publish flow**, which
    is not git-push-triggered at all — pushing to `main` does not redeploy
    the live site; a push to GitHub and a Bolt publish are two independent
    actions. Confirmed empirically: a push to `main` sat live-unreflected on
    the production site for 4+ minutes (cache-bypassed, verified via the
    served bundle's content-hashed filename staying identical) until a
    separate Bolt publish action updated it. Any future deploy-verification
    step should check for a fresh Bolt publish, not assume a GitHub push is
    sufficient or look for Railway build activity.
  - **Correction (2026-08-19): Edge Functions are the one exception.**
    Confirmed empirically: a fix pushed to `supabase/functions/estimate-auditor/index.ts`
    (commit `afe64bc`) was live on the deployed function within about a
    minute of the `git push` — well before any Bolt publish was triggered,
    and confirmed by reading the function's code directly in the Supabase
    dashboard's Edge Functions editor. So this project has two independent
    deploy paths: **frontend** changes need an explicit Bolt publish (the
    behavior documented above), but **Edge Function** changes under
    `supabase/functions/` deploy automatically on push to `main` (almost
    certainly a GitHub Actions workflow or Supabase's own GitHub
    integration wired to this repo, not investigated further). Any future
    Edge Function fix does NOT need a separate deploy step — verify it
    directly against the live function instead of waiting on Bolt.

### Local dev experience
`npm install && npm run dev` is the full path to a running app — genuinely
minimal, no unusual bootstrap steps, no code generation step required before
first run (the Supabase types file `database.types.ts` is checked into the repo
as a static file rather than generated on demand, which is good for a fast
clone-and-run but means it can silently drift from the live DB schema over
time with nothing to catch that).

### Dependency hygiene
Covered in §2 — two direct dependencies a major version behind
(`lucide-react`, `tailwind-merge`), React a major behind, 4 high-severity
transitive vulnerabilities fixable via `npm audit fix`.

---

## 5. Security / Reliability

### Port/boundary validation (JS↔Elm equivalent: client↔Supabase, and
Edge Function request bodies)
- **No runtime schema validation anywhere** (§2) — every `req.json()` in the 8
  Edge Functions and every Supabase query response in the client is trusted via
  TypeScript types only, which provide no protection against a malformed or
  malicious payload at runtime.
- **Concrete finding — role fallback reads from client-writable data.**
  `src/hooks/use-auth.ts:39-66`, `fetchProfile()`: if the `profiles` row fetch
  for the current user returns null (RLS-blocked, missing row, transient
  failure), the code falls back to building a user object from
  `session.user.user_metadata` (line 51), including
  `role: meta.role ?? "crew"` (line 56). This value flows into `App.tsx`'s
  `RoleGuard` and `HomeDashboard`, which gate which routes/dashboards render.
  The problem: `user_metadata` (`auth.users.raw_user_meta_data`) is directly
  writable by any authenticated user via
  `supabase.auth.updateUser({ data: { role: "admin" } })` — and the codebase
  **already knows this**, because migration
  `supabase/migrations/20260608001656_fix_rls_use_app_metadata_not_user_metadata.sql`
  explicitly documents this exact escalation vector and fixes the *database*
  RLS layer to read `app_metadata` instead (which is not client-writable). That
  fix was never mirrored in the client-side fallback in `use-auth.ts`, which
  still reads the vulnerable `user_metadata` field.
  - **Severity in practice**: moderate rather than critical, because the base
    RLS policy `"Users can view own profile"` (migration
    `01_users_and_tenant.sql:30-33`, `USING (auth.uid() = id)`) means a normal
    logged-in user's own profile read should always succeed — so this fallback
    path is only reachable in an edge case (missing profile row, replication
    lag, RLS misconfiguration). But it means the codebase has **the same bug
    fixed in one layer and still present in another**, and any client-side-only
    authorization decision (nav visibility, `RoleGuard`) is not defense-in-depth
    safe if that edge case is ever hit. Real data mutations remain protected by
    the DB-side RLS using `app_metadata`, which is the important backstop.
- Edge Function auth pattern (checked in `supabase/functions/parse-receipt/index.ts`)
  is done correctly: verifies the bearer token via `supabase.auth.getUser()`,
  looks up role from the `profiles` table server-side using the service-role
  key, and falls back to `userData.user.app_metadata?.role` (the *safe* field) —
  this function does it right; it's specifically the client-side `use-auth.ts`
  fallback that doesn't match this pattern.
- CORS on Edge Functions is wide open (`"Access-Control-Allow-Origin": "*"`,
  seen in `parse-receipt/index.ts` and presumably the other 7 functions) — low
  risk here since auth is bearer-token-based rather than cookie-based, but worth
  a deliberate decision rather than a default.

### RLS/security churn
Of ~62 migration files, **16 are named `fix_*` and specifically address RLS
policies or `SECURITY DEFINER` function exposure** — e.g.
`fix_security_definer_functions.sql`, `fix_revoke_public_execute_security_definer.sql`,
`fix_get_my_role_grant_authenticated.sql` →
`fix_get_my_role_security_invoker.sql` →
`revert_get_my_role_to_security_definer.sql` →
`fix_get_my_role_revoke_authenticated_rpc.sql` →
`restore_get_my_role_authenticated_execute.sql` →
`fix_get_my_role_security_definer_rpc_exposure.sql` (six consecutive
back-and-forth fixes to a single `get_my_role()` function's security mode and
grants). This isn't a single finding so much as a pattern: the authorization
model has been iteratively hardened through trial and error over the project's
life, which is a reasonable way to learn Postgres RLS but means the current
state deserves a dedicated, deliberate re-read (ideally by someone other than
the original author) to confirm no earlier vulnerable state was accidentally
left half-reverted. This audit did not re-derive the current effective RLS
policy set from scratch to verify correctness — that would be a good scoped
follow-up.

### Error handling
- **33 empty catch blocks** found (`catch (...) {}` with no body) — errors are
  silently swallowed in these locations rather than logged, surfaced to the
  user, or reported. Combined with the complete absence of an error boundary
  (§3), failures in these paths are simply invisible.
- 130 `catch` blocks total vs. 135 `try` blocks — reasonable 1:1 coverage
  structurally, but coverage isn't the same as *correct handling*; the 33 empty
  ones are the concerning subset.
- Only 27 `console.log/warn/error` calls across the whole app — low observability
  in production; failures that aren't in one of those 27 spots and aren't
  surfaced to the UI leave no trace at all.

### Secrets
- `.env` is **not** tracked in git (confirmed via `git ls-files` and full
  history scan with `git log --all -- .env` — clean, never committed).
- `lib/supabase.ts` correctly uses `VITE_SUPABASE_ANON_KEY` (the public,
  RLS-constrained key) client-side; the service-role key only appears
  server-side in Edge Functions via `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`,
  which is the correct pattern.
- No API keys, tokens, or credentials found hardcoded in source during this
  pass.

---

## 6. Anything Else Worth Flagging

- **Zero TODO/FIXME/HACK/XXX comments anywhere in the codebase.** For a
  6.5-week-old, single-author, 31K-line app with no test suite, this is
  somewhat unusual — it likely means known shortcuts aren't being tracked in
  comments at all (rather than that none exist), given the other findings in
  this report (empty catches, `any` casts, RLS churn). Worth considering
  whether adopting even lightweight TODO comments would help future-you
  compared to institutional memory alone.
- **`elmSyncService.ts`** (`src/services/elmSyncService.ts`) — worth a
  deliberate look at what this syncs and with what, given the app's own name is
  ELM; not reviewed in depth in this pass but flagged since the name could
  cause confusion in exactly the way this whole audit conversation did.
  Recommend a quick read to confirm it's not a leftover from a rename/migration.
- **`CODEBASE_OVERVIEW.txt`** at the repo root is a 1.4MB generated file (likely
  an AI-tool-generated full-source dump). It's committed to git history and adds
  significant repo weight; consider whether it needs to be version-controlled or
  should be `.gitignore`d and regenerated on demand.
- **Solo-author project** — 95 of 99 commits from one person over ~6.5 weeks.
  This context matters a lot for §7 below, and for calibrating how much process
  overhead (CI, tests, formal module boundaries) is worth investing in *right
  now* versus when a second contributor or a longer time horizon appears.
- **`tsconfig.app.tsbuildinfo`** and other build artifacts appear to be tracked
  in git (seen in the `railway/*` branch diff, which removed
  `tsconfig.app.tsbuildinfo` and `tsconfig.node.tsbuildinfo` — 46,677 deletions
  in that branch vs. main, mostly these generated/build artifacts). Worth
  confirming `.gitignore` actually excludes these on `main` going forward.

---

## 7. Plugin vs. Monolith Architecture Question

### Feature map (as-is, not as currently folder-organized)

| Feature area | Own state? | Own data tables/migrations? | Own Edge Functions? | Coupling to core |
|---|---|---|---|---|
| **Planning Board** (mood boards, canvas, furniture, materials) | Yes — `stores/canvas-store.ts` (Zustand) + massive local state in `PlanningBoard.tsx` | Yes — `04_planning_boards.sql`, `create_board_snapshots.sql`, `migrate_paint_elements_to_surface_kind_paint.sql` | Yes — `board-prompt` | Needs `project_id`, current user's role; otherwise self-contained |
| **Cost Estimating** (estimator, supplier prices, pricing book) | Partially — page-local `useState`, no dedicated store | Yes — `05_cost_estimator.sql`, `pricing_book_schema.sql`, `seed_assemblies_and_coverage.sql`, `add_region_to_projects.sql` | Yes — `estimate-generator`, `estimate-auditor`, `estimate-client-reviewer` | Needs `project_id`; reads supplier/pricing tables independently of Planning Board |
| **Crew & Ops** (crew dashboard, trades, timesheets, payroll, master calendar) | Page-local state only | Shares `operations_and_media` migration scope | No dedicated function | Needs role gate (`admin`/`crew`); otherwise disjoint tables from the two above |
| **Client Presentation** (`PublicPresentation.tsx`, `p/:token` route) | Page-local | Uses `get_public_presentation_rpc` | No | Deliberately decoupled already — token-based, no session/role required |
| **Project Watcher / AI features** (`design-critique`, `project-watcher`, `sync-intake`, `generate-social-post`, `parse-receipt`) | N/A (server-side) | `watcher_alerts` table | Yes, 5 separate functions | Each is already an independently deployable Edge Function — Supabase's own architecture already gives you this "plugin" boundary for backend AI features |
| **Admin/Settings, Auth, Onboarding** | Core | `users_and_tenant` | No | This *is* the core — not a candidate for extraction |

### Would a plugin architecture help, for this app specifically?

**No — not right now, and the Elm-specific framing (compile-time flags vs.
separately-compiled modules mounted via ports/web components) doesn't apply
here anyway since this isn't Elm, but the underlying question still has a real
answer for this stack:**

- **Bundle size / initial load**: the app already lazy-loads every route via
  `React.lazy()` in `App.tsx` (all 20 page components). That *is* the
  practical "plugin" mechanism available in this stack — code-splitting per
  route, no client-side load happens for a feature the current user's role
  can't reach, without any additional architecture. A formal plugin system
  would not meaningfully improve on this; the win is already banked.
- **Team/ownership independence**: there is **one developer**. A plugin
  architecture solves a problem — independent teams shipping independent
  release cadences without stepping on each other — that does not exist yet.
  Introducing one now would add real ceremony (separate build configs, version
  coordination, a runtime plugin registry, mount/unmount lifecycle contracts)
  for zero present benefit.
- **Deployment independence**: the app already ships as a single Vite build to
  Railway. Nothing about the current pain points found in this audit (RLS
  churn, empty catches, no tests, one giant component) would be solved by
  splitting deployment units — those are code-quality and process problems,
  not deployment-topology problems. Splitting the *deployment* wouldn't touch
  the actual pain.
- **The real pain is code organization, not loading/deployment** — specifically,
  one 9,942-line component. That's a code-organization and maintainability
  problem, not a "should this load on demand" problem, and it has a much
  cheaper fix than a plugin architecture: decompose `PlanningBoard.tsx`'s
  internal state into per-concern hooks/reducers (canvas elements, drawers,
  presentation mode, versioning could each become their own
  `use-*.ts` hook backed by the existing `canvas-store.ts`), without touching
  build/deploy topology at all.

### Recommendation: **modular monolith, informally — invest in internal
boundaries, not a plugin system.**

Concretely, in priority order:
1. Keep the single Vite build and single deploy target. There's no case for
   splitting it given one developer and ~7 weeks of history.
2. Treat Planning Board, Cost Estimating, and Crew/Ops as the three de facto
   "modules" they already almost are (per the table above — they barely share
   code today). Formalize this only as a **folder/import convention**
   (e.g. `src/features/board/`, `src/features/estimating/`, `src/features/ops/`,
   each owning its own hooks/components/types), not as separately built or
   loaded units. This gets most of the "independent evolution" benefit of a
   plugin system at close to zero cost, because the seams already exist
   naturally in the data model and Edge Functions.
3. The Edge Functions are already independently deployable by nature of being
   separate Supabase functions — no further action needed there; that part of
   the system already has the plugin property this section asks about.
4. Revisit this question again if/when a second developer joins, or if a
   specific feature (most likely Planning Board, given its size) needs to ship
   on a different cadence than the rest of the app. Until then, a formal plugin
   architecture would be solving a team-scaling problem the project doesn't
   have yet, at the cost of ceremony it can't currently afford (no tests, no
   CI — adding plugin infrastructure on top of that foundation would compound
   risk, not reduce it).

If there's a growth trajectory I'm not accounting for (e.g., you're planning to
onboard other developers soon, or intend to white-label this for other studios
beyond Aster & Spruce, which would be a real driver for plugin-style
tenant/feature isolation), that would change this recommendation — let me know
if either is the case rather than have me guess further.

---

## Prioritized Top 10

**Quick wins (hours, not days):**
1. Add a top-level **React error boundary** around `<Router />` in `App.tsx` —
   currently any render error is a blank white screen. Small, high-value.
2. Fix the **33 empty catch blocks** — at minimum log to console/error-tracking;
   several of these are likely hiding real failures right now.
3. Fix the **`use-auth.ts:56` role fallback** to read `app_metadata` instead of
   `user_metadata`, matching the fix already applied at the RLS layer.
4. Run `npm audit fix` for the 4 high-severity transitive vulnerabilities.
5. Add `eslint-plugin-jsx-a11y` and fix the resulting findings (starts with the
   10 clickable-`<div>`s already identified, especially `AppShell.tsx:287`).
6. Decide the fate of `CODEBASE_OVERVIEW.txt` (1.4MB, committed) — regenerate
   on demand or drop from version control.
7. Confirm whether `src/shared/routes.ts` is live or dead code; delete or wire
   it up, don't leave it ambiguous.

**Bigger structural work (days, needs planning):**
8. Introduce a test suite (Vitest + React Testing Library is the natural
   choice given Vite is already the build tool) starting with `CostEstimator.tsx`
   money-math logic and the Edge Function contracts — currently zero coverage
   on the highest-blast-radius code.
9. Decompose `PlanningBoard.tsx` (9,942 lines / 97 `useState`) into per-concern
   hooks backed by `canvas-store.ts` — this is the single highest-leverage
   maintainability investment in the codebase.
10. Do a dedicated, from-scratch re-derivation of the current effective RLS
    policy set (given the 16-migration back-and-forth history on `get_my_role()`
    and related policies) to positively confirm no earlier vulnerable state was
    left half-applied — this deserves fresh eyes rather than trusting that the
    last migration in sequence is correct by construction.

**Open questions for you, not guessed at above:**
- Is the production site actually served by Railway, Netlify, both, or is one
  stale? Worth confirming directly on each platform's dashboard.
- Any near-term plan to add developers or white-label this app for other
  studios? That's the one thing that would change the plugin-vs-monolith
  recommendation in §7.
