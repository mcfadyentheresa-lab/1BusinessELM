# ELM Estimate Area Audit

**Read-only investigation.** No schema, migrations, RLS policies, Edge
Functions, or application code were modified. Scope: everything under the
"estimate" feature — `CostEstimator.tsx`, `EstimatesList.tsx`, the pricing
book (`SupplierPrices.tsx`), the three estimate-related Edge Functions
(`estimate-auditor`, `estimate-client-reviewer`, `estimate-generator`), and
the underlying `project_estimates`/`estimate_items`/pricing tables and their
RLS history.

Every finding below was read directly from the current source — file paths
and line numbers are cited so you can verify each one yourself.

---

## Verdict

The estimate area's authorization model is sound and consistent with the
rest of the schema (admin-only, enforced by RLS, not just app logic — the
exact opposite of the `storage.objects` and `client_invites` issues found
earlier this session). The real problems here are different in kind:

1. **A marketed feature that doesn't exist yet.** The landing page sells
   "locked estimates" with "approval locks with audit trail." No code
   anywhere transitions an estimate out of `draft`, and even the client-side
   `isLocked` gate that already exists has a real hole in it.
2. **A concrete, silent data-loss bug** in how the audit function cleans up
   before writing new warnings.
3. A handful of smaller consistency gaps (no `CHECK` constraint on
   `status`, an unguarded route, wide-open CORS on functions that don't
   strictly need it).

Nothing here is an active exploit against you today — everything is either
admin-only and correctly enforced, or is a correctness/product-completeness
gap rather than a way for an unauthorized party to see or change data they
shouldn't.

---

## 1. The "locked estimate" feature is mostly marketing copy today

`src/pages/LandingPage.tsx:16,42,100` advertises "locked estimates" and
"Estimate approval locks with audit trail" as a real capability. Here's what
actually exists:

- `project_estimates.status text NOT NULL DEFAULT 'draft'`, plus
  `approved_at`, `approved_by`, `sent_at` columns
  (`supabase/migrations/20260526173102_05_cost_estimator.sql:182-199`).
- `CostEstimator.tsx:517`: `const isLocked = estimate?.status !== "draft" && estimate != null;`
  — this is the entire locking mechanism.

**Finding 1a — nothing in the app ever sets `status` to anything but
`draft`.** I grepped every reference to `project_estimates` in `src/` and
found no `Approve`/`Send` button, no `.update({ status: ... })` call, and no
other code path that writes `approved_at`, `approved_by`, or `sent_at`
anywhere. `EstimatesList.tsx:173-178` renders a badge that switches to
`variant="success"` when `status === "approved"`, meaning the UI clearly
expects this state to be reachable — but the only way to actually reach it
today is writing directly to the database outside the app (SQL console).
**The lock feature is currently inert.**

**Finding 1b — even where `isLocked` is wired up, the rename flow bypasses
it in both places it exists.**

- `CostEstimator.tsx:598-606`: the button that *opens* the rename dialog has
  no `disabled` or lock check at all. Only the pencil icon next to the title
  is conditionally hidden (`{!isLocked && <Pencil .../>}`) — that's cosmetic,
  not a guard. Clicking the title text still opens the rename dialog and
  `handleRename` (line 419-434) still runs, regardless of `isLocked`.
- `EstimatesList.tsx:179-185`: the separate rename pencil button here has
  **no status check whatsoever** — not even a cosmetic one. It's
  unconditionally clickable for every estimate regardless of `status`.

By contrast, the other locked-state controls are correctly wired: Save,
Run Audit, and Review for Client are all properly `disabled={... || isLocked}`
(`CostEstimator.tsx:613,627,639`), and the Generate Draft section is wrapped
in `{!isLocked && (...)}` so it doesn't render at all when locked (line 872).
Rename is the one path that was missed in both places it appears.

**Finding 1c — there is no server-side enforcement of the lock at all.**
I checked every migration touching `project_estimates`/`estimate_items` RLS
(`20260526173102_05_cost_estimator.sql`,
`20260526190328_fix_all_rls_policies_use_get_my_role.sql`) — every policy is
purely `get_my_role() = 'admin'`. No `CHECK` constraint, trigger, or RLS
predicate anywhere references `status`. Today this is low-stakes because the
lock is unreachable anyway (Finding 1a) — but it means that when the
Approve/Send flow eventually gets built, the client-side `isLocked` checks
that already exist will remain the *only* thing stopping a locked estimate
from being edited. Any admin session — via devtools, a future bug, or simply
the rename gap above — could silently rewrite an "approved" estimate with no
record that it happened, defeating the entire promised "audit trail."

**Why this matters for the business**: if a client has been sent an
"approved" estimate and it can still be silently renamed or (once the
missing enforcement above is built) edited, the audit trail you're already
marketing doesn't actually hold up. This is worth closing before "locked
estimates" is something you'd rely on in a dispute with a client.

**✅ BUILT (2026-08-19)** — all three findings above are now resolved for
real, not just noted. Design discussed and agreed with the app's owner
first: approving locks an estimate; an admin can unlock it to make
corrections rather than being forced into a new estimate for every change,
but every approval and every unlock is logged to a new, genuinely
append-only `estimate_status_history` table (no `UPDATE`/`DELETE` policy
exists on it at all — same intentional pattern as `material_price_history`
in §6). Approval also snapshots the full estimate + line items as they
stood at that moment, so "what did the client actually see and agree to"
stays answerable even after a later unlock-and-change.

- **1a resolved**: `approve_estimate(p_estimate_id)` and
  `unlock_estimate(p_estimate_id, p_reason)` RPCs
  (`supabase/migrations/20260819170000_estimate_approval_lock_with_audit_trail.sql`)
  are the only two ways `status` can change now. A real "Approve"/"Unlock"
  button pair exists in `CostEstimator.tsx`, and a history section on the
  page itself lists every approval/unlock with who, when, and (for
  unlocks) the required reason — the audit trail is visible in the app,
  not just sitting in the database.
- **1b resolved**: both rename triggers found in this finding are now
  gated. `CostEstimator.tsx`'s rename button is `disabled={isLocked}`;
  `EstimatesList.tsx`'s rename pencil is only rendered at all when
  `est.status === "draft"`.
- **1c resolved — this is the one that actually matters most.** The
  `project_estimates` UPDATE policy and all three
  `estimate_items` write policies (INSERT/UPDATE/DELETE) now additionally
  require `status = 'draft'` (via a join back to the parent estimate for
  `estimate_items`). This was verified live against the real production
  database, not just read from the migration: a direct `UPDATE ... SET
  name = 'HACKED'` against an approved estimate is silently filtered by
  RLS (row unchanged), and a direct `INSERT` into `estimate_items` for an
  approved estimate raises a genuine `42501` RLS violation — confirmed in
  a rolled-back transaction, so nothing in production was actually
  touched by the verification itself. The two RPCs above are
  `SECURITY DEFINER` specifically so they remain the sole exception to
  this new restriction. A CHECK constraint (`status IN ('draft',
  'approved')`) was also added, closing §4 below at the same time.
  Testing this also caught and fixed a real bug before it ever shipped:
  the first version's admin check (`get_my_role() <> 'admin'`) silently
  passed for a user with no `profiles` row at all, because `NULL <>
  'admin'` evaluates to `NULL` in SQL, which PL/pgSQL's `IF` treats as
  false. Fixed to `IS DISTINCT FROM`, which handles `NULL` correctly, and
  reconfirmed live that a fabricated non-admin identity is now correctly
  rejected.

---

## 2. `estimate-auditor` silently deletes client-review warnings — confirmed bug

Both `estimate-auditor` and `estimate-client-reviewer` clean up old warnings
before inserting fresh ones each time they run. I compared the two side by
side:

**`estimate-client-reviewer/index.ts:150-167`** (correct — scoped by source):
```ts
await db.from("estimate_warnings").delete()
  .eq("estimate_id", estimateId).eq("source", "client_review").eq("ignored", false);
// ...
await db.from("estimate_warnings").delete()
  .in("estimate_item_id", itemIds).eq("source", "client_review").eq("ignored", false);
```

**`estimate-auditor/index.ts:280-296`** (missing the `source` filter):
```ts
await db.from("estimate_warnings").delete()
  .eq("estimate_id", estimateId).eq("ignored", false);
// ...
await db.from("estimate_warnings").delete()
  .in("estimate_item_id", itemIds).eq("ignored", false);
```

`estimate_warnings.source` distinguishes `'audit'` from `'client_review'`
rows, and the frontend treats them as two separate buckets
(`CostEstimator.tsx:333-334`, separate badge counts for "Run Audit" vs.
"Review for Client"). Because the auditor's cleanup delete has no `source`
filter, **running "Run Audit" deletes every non-ignored warning for that
estimate — including client-review flags that have nothing to do with cost
auditing.**

**Concrete scenario**: an admin runs "Review for Client," gets 3 unclear-item
flags, leaves them unresolved while they finish adding line items, then
clicks "Run Audit." The 3 client-review flags vanish with no notification —
not marked ignored, not resolved, just gone. The admin has no way to know
this happened unless they happen to re-run "Review for Client" again and
notice the count looks the same as before.

This is a straightforward one-line fix (add the same `.eq("source", "audit")`
filter the client-reviewer already uses correctly) — flagging it here as a
confirmed bug, not implementing it since this report is read-only.

---

## 3. Edge Function authorization — consistent, but worth naming explicitly

All three functions (`estimate-auditor`, `estimate-client-reviewer`,
`estimate-generator`) share an identical, correctly-implemented auth
pattern: validate the bearer token via `db.auth.getUser()`, look up
`profiles.role` (falling back to `app_metadata.role`), require `'admin'`.
All three use the `SUPABASE_SERVICE_ROLE_KEY` internally, so this role check
*is* the actual authorization boundary — RLS doesn't backstop these calls.

**Not a new finding, but worth naming precisely**: none of the three verify
that the calling admin has any specific relationship to the `estimate_id` /
`project_id` they pass in — any authenticated admin can audit, review, or
generate for any estimate or project in the deployment. Per
`TENANCY_AUDIT.md`, this app is genuinely single-tenant today (`admin` is a
global role with no per-company scoping anywhere), so this is consistent
with every other admin-scoped table in the schema — not a live gap. But
`TENANCY_AUDIT.md`'s fix list item 4 ("Add contractor-ownership checks to
every Edge Function that accepts a client-supplied `project_id`") already
names this category of work generically; this audit confirms the three
estimate functions belong on that list by name, specifically:
`estimate-auditor` (`estimate_id`), `estimate-client-reviewer`
(`estimate_id`), `estimate-generator` (`project_id`). No action needed now —
this is explicitly deferred, gated work per the resolved tenancy decision.

**Minor hardening note**: all three functions set
`"Access-Control-Allow-Origin": "*"`. Actual risk here is low specifically
*because* auth is via a `Bearer` token the calling page must explicitly read
from its own session and attach — unlike cookie-based auth, a third-party
site can't silently ride an authenticated session through wildcard CORS the
way a CSRF attack would work against cookies. Still, restricting these to
the app's own origin would be a small, consistent hardening step, and is
inconsistent with the tightening already done elsewhere this session (e.g.
revoking `PUBLIC` execute on `get_my_role()`).

---

## 4. Schema gaps around `project_estimates.status` — ✅ RESOLVED (2026-08-19)

`supabase/migrations/20260526173102_05_cost_estimator.sql:186`:
```sql
status text NOT NULL DEFAULT 'draft',
```

No `CHECK` constraint restricted this to a known set of values — unlike
other status-bearing tables in this schema, e.g. `watcher_alerts.status`
which has an explicit `CHECK (status IN (...))`
(`20260720003809_create_watcher_alerts.sql`). Closed as part of building
the real approve/unlock flow in §1:
`ALTER TABLE project_estimates ADD CONSTRAINT project_estimates_status_check
CHECK (status IN ('draft', 'approved'));`. Verified safe to add before
applying it — queried the live table first and confirmed every existing
row was already `'draft'`, so no data migration was needed.

---

## 5. Crew has zero visibility into estimates — likely intentional, but creates a route-level UX gap

Confirmed live in `20260526190328_fix_all_rls_policies_use_get_my_role.sql:139-142,214-216,112-114`:
`estimate_items`, `project_estimates`, and `crew_rates` are **all
admin-only for every operation, including `SELECT`**. Crew members cannot
see estimates or their own labour rates at all. This may well be
intentional — the tenancy audit's own framing is that pricing/estimates are
treated as sensitive fixtures across this whole schema — so I'm not
recommending a change here, just flagging the consequence:

`App.tsx`'s route table wraps every other admin-only page
(`SupplierPrices`, `Payroll`, etc.) in a `RoleGuard`, but
`/project/:projectId/estimates` and `/project/:projectId/estimate/:estimateId`
have no such guard. A crew or client user *can* navigate to these routes.
Because RLS correctly returns zero rows, `CostEstimator.tsx:169-174`'s
`.single()` query will error (Supabase's `.single()` requires exactly one
row) — but that error isn't surfaced anywhere in the component. The result:
a crew/client user who lands on this route sees a mostly-blank "Cost
Estimator" page with one empty line item and no explanation, instead of a
clear redirect or access-denied message. Not a security hole — the data is
correctly hidden — but worth the same `RoleGuard` treatment the other
admin-only pages already get, purely for a cleaner failure mode.

**✅ Failure mode fixed (2026-08-19)** as part of building the approval
flow in §1 — the estimate routes now have `RoleGuard(allowedRoles=["admin"])`,
so a crew/client user is cleanly redirected with a toast instead of seeing
a blank page. Confirmed live by the app's owner using the "Preview as:
Client" toggle.

**Open product question raised by the app's owner (2026-08-19), not yet
answered**: is client-side invisibility actually correct here, or is it
its own gap? The app markets sending an approved estimate to a client
(`sent_at` column, `LandingPage.tsx`'s "client presentations" framing,
now-real "locked estimates") — but nothing in this schema lets a `client`
role see *any* estimate, even their own, once approved and sent. If clients
are meant to actually view what they approved, that's a real, separate
piece of work (almost certainly its own read-only RLS policy scoped to
"this client's own project's approved estimate," not simply opening up
admin-level estimate access) — tracked as fix list item 7 below, not
sized or started yet.

## 6. What's already solid (confirmed, not just assumed)

- **Money math**: `src/lib/estimate-math.ts` (contingency → markup →
  management fee chain) already has a dedicated Vitest suite
  (`estimate-math.test.ts`) from earlier this session, with hand-verified
  expected values covering the full chain, the markup-disabled short
  circuit, and blank/zero-input edge cases. Not re-litigated here.
- **`material_price_history` has no `UPDATE`/`DELETE` policy at all**
  (`20260620202455_pricing_book_schema.sql:14-24`) — worth calling out as a
  *good* pattern, not a gap: it makes the price-history table effectively
  append-only, which is exactly what you want from an audit trail of
  historical pricing.
- **Every other RLS policy in the estimate area** (`cost_categories`,
  `market_rates`, `subcontractors`, `suppliers`, `supplier_prices`,
  `regional_modifiers`, `receipts`, `estimate_assemblies`,
  `assembly_materials`) consistently uses `get_my_role()` and correctly
  restricts writes to admin, matching the pattern used everywhere else in
  this schema — no anomalies found across any of them.

---

## 7. Reliability findings (2026-08-19/20) — data integrity, not security

Raised by the app's owner: "I want to work on the entire estimate piece so I
trust it 100 percent." These are all confirmed by directly reading the code,
not assumed — separate in kind from the security findings in §1-§5 above.
None of these have been fixed yet.

**7a — the Save flow can silently lose all of an estimate's line items.**
`CostEstimator.tsx:408-446`, `handleSave` does three writes in sequence:
update settings, delete all existing `estimate_items` for this estimate,
then insert the new set. **None of the three check for an error** —
confirmed by grepping every `await supabase.` call in the file: rename
(`:453`), approve (`:468`), unlock (`:486`), and the warning-ignore mutation
(`:570`) all correctly destructure and check `{ error }`. These three,
inside the single most important write path in the whole feature, don't. If
the delete succeeds but the insert fails for any reason — a malformed
value, a dropped connection, anything — the code doesn't throw. It proceeds
straight to `toast({ title: "Estimate saved" })` while the database now has
**zero line items** for that estimate. Local React state isn't touched, so
the admin sees success with their items still visibly on screen; the data
loss is invisible until the estimate is next loaded, by anyone.

**7b — even with 7a fixed, delete-then-reinsert isn't atomic.** It's two
separate network round-trips, not one transaction. A dropped connection or
closed tab between them leaves the estimate with no items — same end state
as 7a, different trigger (an interruption rather than a caught-and-ignored
error). The real fix for 7a and 7b together is the same one used for
approve/unlock in §1: a single `SECURITY DEFINER` database function that
does the update/delete/insert in one transaction, so a failure anywhere
rolls back the whole save and a real error reaches the UI.

**✅ 7a/7b FIXED (2026-08-20)** — see item 9 in the fix list below for the
full detail and live verification evidence.

**7c — zero input validation on quantity, unit cost, or material cost.**
`CostEstimator.tsx:791-856`: all three are plain `<Input>` (text), no
`type="number"`, no `min`, no pattern — nothing stops blank, negative, or
non-numeric text from being typed in.

**✅ 7c FIXED (2026-08-20)** — see item 10 in the fix list below for the
full detail and live verification evidence.

**7d — that gap has a silent, ugly consequence: one bad character zeroes
the whole displayed total.** `formatCurrency` (`src/lib/utils.ts:8-12`)
converts `NaN` to `"$0.00"` instead of surfacing an error. The totals chain
in `estimate-math.ts` (`subtotal → contingency → markup → management fee →
total`) has no guard against `NaN`, and `NaN` poisons every arithmetic
operation it touches via `Array.reduce`. Result: typing anything
non-numeric into a single line item's quantity or cost field makes the
**entire estimate's total silently render as $0.00** — no error, no
highlighted field, nothing indicating which line item caused it. A
five-figure estimate could display "$0.00" with zero warning if this is
missed, right before being approved and snapshotted as the official
record.

**7e — `estimate_items.labor_cost` is a dead write-only column that
inherits the same bug.** `CostEstimator.tsx:431`:
`labor_cost: String(parseFloat(item.unit_cost) * parseFloat(item.quantity))`
is written on every save. Grepped every reference to `labor_cost` across
`src/` and `supabase/functions/` — it is written here and nowhere else;
nothing reads it back for totals, warnings, or reporting. Low practical
impact today (the real math is always recomputed live from `unit_cost`/
`quantity`/`material_cost`), but it can silently store the literal string
`"NaN"` under the same conditions as 7d, and it's confusing dead weight
either way — worth either wiring it up to something real or removing it.

**7f — zero automated test coverage for any of the above.** `find src
-iname "*.test.ts*"` turns up exactly two files: `use-auth.test.ts` and
`estimate-math.test.ts`. The latter only covers the pure math functions
(already solid, see §6) — none of the actual persistence logic (Save,
Approve, Unlock) or the RLS enforcement (verified live by hand in §1, not
by an automated test) has any regression protection. A future change could
silently reintroduce 7a-7e, or break the approve/unlock lock, with nothing
catching it.

**On making this its own product**: also raised by the app's owner —
whether the estimate piece should eventually become a standalone/white-label
product or a pluggable module rather than an ELM page. Recommendation:
sequence reliability before extraction. 7a/7d in particular are exactly the
kind of bug you don't want to carry into something other businesses depend
on — cheaper to fix once now, while this is low-stakes and internal, than
mid-extraction later. Not sized or started; a real architectural
conversation for once the core is solid.

---

## Prioritized fix list

**Worth fixing regardless of any product decision (small, self-contained):**
1. ~~**`estimate-auditor`'s cleanup delete**~~ — **✅ FIXED** (2026-08-19).
   Added `.eq("source", "audit")` to both delete calls
   (`index.ts:282-286,291-295`), matching the pattern
   `estimate-client-reviewer` already uses correctly. `estimate_warnings.source`
   defaults to `'audit'` at the DB level
   (`20260801205138_add_source_column_to_estimate_warnings.sql`), so this
   correctly matches every row the auditor itself has ever inserted —
   client-review warnings are no longer touched by an audit run.
2. ~~**Gate the rename flow on `isLocked`**~~ — **✅ FIXED** (2026-08-19).
   `CostEstimator.tsx:598-606`: the rename trigger button is now
   `disabled={isLocked}`. `EstimatesList.tsx:179-185`: the rename button is
   now only rendered at all when `est.status === "draft"`, matching the
   hide-entirely pattern already used for Generate Draft (§1b). Still
   unreachable in practice today (§1a), but the gap is closed before it
   matters.
3. ~~**Add `RoleGuard` to the estimate routes**~~ — **✅ FIXED** (2026-08-19).
   `App.tsx`: `/project/:projectId/estimates`,
   `/project/:projectId/estimate/:estimateId`, and `/project/:id/estimate`
   now wrap `EstimatesList`/`CostEstimator` in `RoleGuard` with
   `allowedRoles={["admin"]}` — matching the actual RLS access level
   confirmed in §5 (crew has zero access, not just restricted access), not
   the `["admin","crew"]` pattern used on pages crew genuinely can see.
   Confirmed the two existing links to these routes
   (`ProjectDetails.tsx:657,863`) were already `{isAdmin && (...)}`-gated,
   so this is additive protection with no dead links introduced for other
   roles.

4. ~~If yes: build the actual Approve/Send flow~~ — **✅ BUILT (2026-08-19)**,
   see the resolution note under §1 and the CHECK constraint note under §4
   for the full detail and live verification evidence. The landing page's
   "locked estimates" / "approval locks with audit trail" copy is now
   actually true.

**Not urgent, just noted:**
6. Restrict Edge Function CORS from `*` to the app's own origin, for
   consistency with hardening already done elsewhere (§3).
7. `estimate-auditor`/`estimate-client-reviewer`/`estimate-generator`'s
   missing per-estimate/per-project ownership checks are explicitly covered
   by, and gated the same as, `TENANCY_AUDIT.md` item 4 — no separate
   action needed, just noting these three functions by name for whenever
   that structural work actually starts.
8. **Clients can't see their own estimate at all, not even after it's
   approved and sent** — raised by the app's owner (2026-08-19) while
   testing the new approval flow via the "Preview as: Client" toggle. See
   the "Open product question" note under §5 for the full framing. Explicitly
   deferred — "add to the list to address when it makes sense," not sized
   or scoped yet. When it's picked up, the real question to answer first is
   *what* a client should see (the full line-item breakdown, or just the
   locked total/summary) before reaching for an RLS policy — that product
   decision should come before the implementation, same as the locked-
   estimate work did.

**Reliability (§7) — the app's owner wants to work through this whole group
before trusting the estimate piece completely. Starting with #9.**
9. ~~**Fix the Save flow (§7a/§7b)**~~ — **✅ FIXED (2026-08-20)**. New
   `save_estimate(p_estimate_id, ...settings, p_items jsonb)` — same
   `SECURITY DEFINER` pattern as `approve_estimate`/`unlock_estimate` — does
   the settings update, delete, and insert inside one Postgres transaction
   (`supabase/migrations/20260820120000_atomic_save_estimate.sql`), so any
   failure anywhere rolls back the whole save. Explicitly re-checks
   `status = 'draft'` inside the function, since a `SECURITY DEFINER`
   function would otherwise bypass the RLS lock enforcement from §1 —
   confirmed live that saving a just-approved estimate is correctly
   rejected (`Cannot save a locked estimate`). `CostEstimator.tsx`'s
   `handleSave` now calls this RPC and actually checks its error, replacing
   the three unchecked writes.

   **Verified live** (all in rolled-back transactions, nothing in
   production touched by the tests themselves): seeded a real line item,
   then called `save_estimate` with a second item carrying a deliberately
   invalid `assembly_id` (violates a foreign key) — the insert genuinely
   failed, and the seeded item was still present afterward, confirming the
   delete got rolled back too, not just the insert (this is the exact
   scenario that used to silently empty an estimate). A genuine successful
   save with two items — one with a garbage (`"abc"`) quantity — correctly
   replaced the item set and computed `labor_cost: 0` for the bad value
   via a new `safe_numeric()` helper, instead of the old code's literal
   `"NaN"` string (§7e; the helper doesn't fix 7c/7d, it just stops this
   one function from making them worse). A non-admin identity attempting
   to call `save_estimate` directly was correctly rejected.
10. ~~**Add input validation to quantity/unit cost/material cost**~~ (§7c) —
    **✅ FIXED (2026-08-20)**. Two layers: client-side, `CostEstimator.tsx`'s
    quantity/unit_cost/material_cost `<Input>`s now run through a new
    `sanitizeNumericInput()` helper on every change, stripping any character
    that isn't a digit or `.` and collapsing extra `.`s, plus
    `inputMode="decimal"` for a numeric keyboard on mobile — invalid
    characters can no longer be typed or pasted in. Server-side (closing the
    gap for a direct API call that bypasses the client entirely),
    `save_estimate` (`supabase/migrations/20260820130000_validate_estimate_item_numbers.sql`)
    now rejects the entire save if any line item's quantity, unit_cost, or
    material_cost is non-empty and not a valid non-negative decimal, before
    any write — inside the same atomic transaction as item 9, so an invalid
    item rejects the whole save with nothing touched. Empty string stays
    allowed (a placeholder item with just a category set), matching the
    fix's own framing — only garbage and negative values are rejected.

    **Verified live** (all in rolled-back transactions, nothing in
    production touched by the tests themselves): a save with a garbage
    quantity (`"abc"`) was rejected with the new error message; a save with
    a negative quantity (`"-5"`) was rejected the same way; a save with a
    valid decimal item (`quantity: "12.5"`) alongside a second item with
    empty-string quantity/unit_cost/material_cost succeeded, and both rows
    landed correctly (empty strings stored as empty, not coerced or
    rejected). Client-side sanitizer changes checked lint/tsc-clean against
    the pre-change baseline (52 problems before and after — no new issues
    introduced).
11. ~~**Stop `NaN` from silently rendering as `$0.00`**~~ (§7d) —
    **✅ FIXED (2026-08-21)**. `calcItemTotal` (`estimate-math.ts`) no longer
    does a raw `parseFloat` on quantity/unit_cost/material_cost — a new
    `safeNumber()` helper treats anything that isn't a valid non-negative
    decimal (or empty string) as `0` for that item's contribution, instead
    of letting `NaN` through. That was the actual bug: `NaN` poisons
    `Array.reduce`, so one bad line item zeroed the *entire* estimate's
    total, not just its own row — `computeEstimateTotals` needed no other
    change since it was always built on `calcItemTotal`.

    Per the audit's own framing, did both halves rather than picking one:
    with #10 already making bad input essentially impossible to save
    (§7c), the only way to reach this state at all now is a transient
    editing value the sanitizer still allows through as text but that
    isn't a complete number yet — a bare `"."` typed into an empty field is
    the one case (`sanitizeNumericInput` allows a lone `.` so the field
    doesn't reject the keystroke that starts `"0.5"`). So on top of the
    NaN-safe math, added the visible-warning half too: a new
    `lineItemHasInvalidNumbers()` export flags any item with an invalid
    quantity/unit_cost/material_cost, `CostEstimator.tsx` uses it to give
    that row's card a destructive-red border and a tooltip'd
    `AlertTriangle` next to its (now-excluded, not NaN'd) line total, plus a
    banner above the totals panel whenever any item is flagged — so a
    stray `.` is now visible at both the row and the total, and never
    silently reads as "the whole estimate is worth $0.00."

    **Verified**: added regression tests to `estimate-math.test.ts`
    (12 tests, all passing) covering the exact failure mode — a bad
    quantity now returns `0` instead of `NaN` from `calcItemTotal`, and a
    two-item estimate with one bad item now totals correctly on the
    remaining good item instead of NaN-ing to `$0.00`
    (`"excludes one invalid item's numbers rather than NaN-ing the whole
    total"`), plus coverage for `isValidLineItemNumber`/
    `lineItemHasInvalidNumbers` directly. Lint/tsc-checked clean on both
    changed files (`CostEstimator.tsx` unchanged at 52 problems vs.
    baseline, `estimate-math.ts` zero issues). Not manually verified
    end-to-end in the browser — the local dev preview requires signing in,
    which is outside what I do myself; the math-level fix is the part that
    actually mattered (the UI warning is a secondary affordance on top of
    it), and it's fully covered by the test suite above.
12. ~~**Fix or remove the dead `labor_cost` column**~~ (§7e) —
    **✅ FIXED (2026-08-21)**. Removed rather than wired up — grepping
    `src/` and `supabase/functions/` confirmed nothing ever read it back,
    so there was no reporting/UI need to preserve. `ALTER TABLE
    estimate_items DROP COLUMN labor_cost;`
    (`supabase/migrations/20260821140000_drop_dead_labor_cost_column.sql`),
    `save_estimate` no longer computes or inserts it, and `safe_numeric()`
    (added in 20260820120000 solely to make that computation NaN-safe) is
    dropped too since it had no other caller left. `database.types.ts`
    updated to match. Verified live: `save_estimate` still saves correctly
    post-migration (checked in a rolled-back transaction — the returned row
    has no `labor_cost` field at all), and the full test suite (36 tests,
    including the item 13 harness which replays this migration as part of
    its real migration history) still passes with no changes needed to any
    test.
13. ~~**Build real test coverage for the persistence/approval logic**~~
    (§7f) — **✅ FIXED (2026-08-21)**. Correction to this item's own
    framing: no PGlite-based harness actually existed anywhere in the repo
    before this — the storage/tenancy verification earlier this engagement
    was manual, live, by-hand SQL Editor testing against production
    (`BEGIN; SET LOCAL ROLE authenticated; ...; ROLLBACK;`), not an
    automated test. That pattern is real and sound, though, so it's what
    got automated here: `supabase/tests/db.ts` spins up a fresh in-memory
    Postgres via `@electric-sql/pglite` (real Postgres compiled to WASM —
    no Docker needed) and replays **every one of this project's actual 62
    migration files**, in order, against it. Only 12 files are skipped, all
    verified by inspection to touch nothing but the `storage`/`pg_net`
    schemas Supabase manages outside user migrations and which nothing
    estimate-related depends on. A hand-built `auth` schema stub
    (`auth.uid()`/`auth.jwt()` reading the same `request.jwt.claims` GUC
    PostgREST sets in production) plus the `ALTER DEFAULT PRIVILEGES` grants
    Supabase's platform bootstrap applies outside of migrations stand in for
    what Supabase provisions around user migrations. Tests then impersonate
    a real user via `asUser()` — the same BEGIN/SET LOCAL ROLE/SET LOCAL
    JWT-claims/ROLLBACK shape as the manual verification, just automated,
    with an opt-in `{ commit: true }` for fixture setup a later test needs
    to see.

    Two suites, 20 tests, all exercising the actual RLS policies and
    `SECURITY DEFINER` functions that ship to production (not a mock of
    them): `supabase/tests/save-estimate.test.ts` covers atomicity (a
    forced FK failure mid-insert leaves the prior item set intact, not
    empty — item 9's regression), delete-then-replace semantics, admin-only
    enforcement including the exact NULL-role bug caught live this
    engagement (an unseeded identity, `get_my_role() IS NULL`, must still
    be rejected — `IS DISTINCT FROM` not `<>`), the locked-estimate
    rejection, and item 10's validation (garbage/negative rejected, empty
    string allowed). `supabase/tests/estimate-approval.test.ts` covers
    `approve_estimate`/`unlock_estimate` end to end — snapshot content,
    audit-trail rows, the same NULL-role regression, the empty/whitespace
    reason requirement — plus the RLS lock itself as defense in depth:
    direct writes to an approved estimate's settings or line items are
    rejected even for an admin bypassing the RPCs entirely, and
    `estimate_status_history` accepts no UPDATE/DELETE from anyone, admin
    included, because no such policy exists on it at all.

    Building the harness surfaced one real gap in the harness itself, not
    production: an early draft of the approval fixture used the
    always-rollback `asUser()` to set up its "already approved" starting
    state, so the approval never actually committed and four tests were
    silently exercising a draft estimate instead of a locked one - caught
    because the RLS-defense-in-depth tests then failed in a way that made
    no sense for a still-draft estimate. Fixed by adding the `{ commit:
    true }` option rather than by loosening what the tests asserted.

    All 20 pass; full suite (36 tests across all four `*.test.ts` files)
    runs in about a second, no Docker or network access required. Lint/tsc
    clean on every new file.
14. **Revisit "make it its own product" once 9-13 are done** — discussed
    (2026-08-21), now that 9-13 are all fixed. Conclusion: the estimator's
    own code (`CostEstimator.tsx`, `estimate-math.ts`, its dozen-ish
    tables) is already fairly self-contained and now reliable — the actual
    blocker for either framing (a plugin ELM users enable, or a fully
    standalone white-label app) is the multi-tenancy rewrite
    `TENANCY_AUDIT.md` already scoped: every RLS policy here checks
    `get_my_role() = 'admin'`, not "does this row belong to your business,"
    so there's no way to isolate a second contractor's estimates without
    it. The two framings aren't equally sized once tenancy is done, though
    — a plugin reuses ELM's existing auth/projects/profiles and just needs
    the estimator's supporting tables (categories, market rates, assemblies)
    scoped per-tenant and feature-flagged; a standalone app is a separate
    product with its own auth/onboarding/billing that happens to reuse some
    SQL and components. Explicitly a someday/phase-2 idea, not driven by a
    specific second contractor or licensing conversation right now — stays
    exactly where `TENANCY_AUDIT.md` already put it: real but not urgent,
    revisit when a second business is actually on the table, at which point
    plugin-vs-standalone becomes the next question to answer.
