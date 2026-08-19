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

## 4. Schema gaps around `project_estimates.status`

`supabase/migrations/20260526173102_05_cost_estimator.sql:186`:
```sql
status text NOT NULL DEFAULT 'draft',
```

No `CHECK` constraint restricts this to a known set of values — unlike
other status-bearing tables in this schema, e.g. `watcher_alerts.status`
which has an explicit `CHECK (status IN (...))`
(`20260720003809_create_watcher_alerts.sql`). Currently dormant, since
nothing writes to `status` at all (§1a) — but the moment an
Approve/Send flow is built, a stray typo or bug in that new code could set
`status` to a value that doesn't match what the UI checks for
(`EstimatesList.tsx:174` compares against the literal string `"approved"`),
silently breaking the badge and the `isLocked` gate without any error.
Worth adding alongside whatever builds the actual approve/send functionality
— not urgent in isolation since there's no live write path to worry about
yet.

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

---

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

**Needs a product decision first — is "locked estimates" something you
actually want to ship, or should the landing-page copy change instead?**
4. If yes: build the actual Approve/Send flow (sets `status`, `approved_at`,
   `approved_by`, `sent_at`), add a `CHECK` constraint on `status`
   (§4), and add real server-side enforcement (RLS predicate or trigger
   blocking writes to `project_estimates`/`estimate_items` once
   `status <> 'draft'`) so the lock isn't purely a client-side courtesy
   (§1c). This is real feature work, not a quick fix — sizing it is a
   separate conversation once you decide you want it.
5. If the feature isn't a near-term priority: consider softening the
   landing-page copy ("locked estimates," "approval locks with audit
   trail") until it's actually true, so it doesn't set an expectation the
   product doesn't currently meet.

**Not urgent, just noted:**
6. Restrict Edge Function CORS from `*` to the app's own origin, for
   consistency with hardening already done elsewhere (§3).
7. `estimate-auditor`/`estimate-client-reviewer`/`estimate-generator`'s
   missing per-estimate/per-project ownership checks are explicitly covered
   by, and gated the same as, `TENANCY_AUDIT.md` item 4 — no separate
   action needed, just noting these three functions by name for whenever
   that structural work actually starts.
