# ELM Multi-Tenancy Readiness Audit

**Read-only investigation.** No schema, migrations, RLS policies, or application
code were modified. Scope: is the data model safely isolated per contractor
account, ahead of designing a per-contractor feature-entitlement layer.

**Correction on scope**: the brief asked me to check "the camryn-* functions
found earlier, if they're part of this app." They aren't — `camryn-vitals` lives
in a completely separate, unrelated project (`4Camryn`) on this machine. ELM's
actual Edge Functions are `board-prompt`, `design-critique`, `estimate-auditor`,
`estimate-client-reviewer`, `estimate-generator`, `generate-social-post`,
`parse-receipt`, `project-watcher`, `sync-intake` — all reviewed in §3 below.

**Update (2026-08-18): the two live vulnerabilities in §2/§4 (`client_invites`
anon SELECT, storage UPDATE/DELETE) have been fixed** — see the "FIXED"
callouts inline in §2 and the top of §5 for verification evidence. Everything
else in this report (the tenancy findings proper) is unchanged and still
describes the current state; those were explicitly out of scope for the fix.

---

## Verdict: **NOT TENANT-SAFE**

This is not "gappy" — it's not tenant-aware at all, at any layer. The schema,
every RLS policy, and the application code were built for exactly one company
(Aster & Spruce) with three *roles* (`admin`, `crew`, `client`), not for
multiple *companies* sharing a deployment. There is no `contractor_id` /
`company_id` / `tenant_id` column on any of the 52 tables in the schema. The
`tenant_key` column that does exist (on `tenant_settings` and `feature_flags`)
is vestigial — it defaults to `'default'`, nothing else references it as a
foreign key, and the one place the frontend reads it
(`src/hooks/use-tenant-brand.ts:27`) hardcodes the literal string `"default"`
in the query. If a second contractor were onboarded onto this same deployment
today with zero changes, every `admin` and `crew` user from *either* company
would see 100% of both companies' projects, clients, estimates, pricing, and
messages — via completely ordinary use of the app, not an exploit.

This isn't a criticism of build quality — RLS is used consistently and
correctly *for the single-tenant model it was designed for* (see §2). It's a
statement about what it wasn't designed for. Layering entitlements on top of
this today would only gate *features*, not *data* — Contractor B would still
see Contractor A's data through any feature they're both entitled to.

Two unrelated, real, already-live vulnerabilities also surfaced during this
investigation (not tenancy issues — this app has no tenants yet — but real
data exposure in the single-tenant deployment as it stands today). Flagged in
§4 and prioritized in §5 alongside the tenancy work, since they're both
"trusts client-side enforcement that RLS doesn't actually provide," the exact
class of mistake this investigation was asked to look for.

---

## 1. Schema-level tenant scoping

**No table has a `contractor_id`/`tenant_id`/equivalent column.** Confirmed by
enumerating all 52 `CREATE TABLE` statements across all 52 migrations and
grepping for `contractor_id|company_id|tenant_id|org_id|organization_id` — zero
matches (the one `subcontractor_id` hit is unrelated: it's a foreign key to the
`subcontractors` table, i.e. trade contractors *hired by* the single company,
not a multi-tenancy column).

The closest thing to a tenant concept:
- **`tenant_settings`** (`supabase/migrations/20260526172848_01_users_and_tenant.sql:56-75`) —
  a config table for ONE row (brand name, logo, SMS settings). `tenant_key text
  UNIQUE DEFAULT 'default'` looks like a leftover from a multi-tenant SaaS
  starter template; nothing in the schema or app ever inserts a second row or
  varies which row is read per-user.
- **`feature_flags`** — same `tenant_key DEFAULT 'default'` pattern, same
  non-use. This table is actually the natural foundation for the
  entitlement system being planned, but it currently can't distinguish
  *which contractor* a flag applies to.

**Global vs. per-project vs. per-contractor, as the schema actually models it:**
- **Global (visible to every admin/crew regardless of "which company")**: `profiles`,
  `tenant_settings`, `feature_flags`, `cost_categories`, `market_rates`,
  `crew_rates`, `subcontractors`, `suppliers`, `supplier_prices`,
  `material_price_history`, `regional_modifiers`, `estimate_assemblies`,
  `assembly_materials`, `paint_colors`, `board_templates`, `queued_sms`,
  `watcher_runs`. In a real multi-tenant world, pricing/rate/supplier data
  absolutely should NOT be global — this is a contractor's proprietary
  pricing book.
- **Per-project** (scoped via `project_id`, but project itself has no
  contractor owner): `projects`, `milestones`, `sub_milestones`, `sections`,
  `tasks`, `photos`, `documents`, `messages`, `checklist_items`,
  `calendar_events`, `activity_log`, `decisions`, `change_orders`,
  `site_visits`, `selections`, `planning_boards`, `canvas_elements`,
  `board_items`, `board_snapshots`, `board_presentation_tokens`,
  `time_entries`, `social_posts`, `cinematic_reviews`, `room_renders`,
  `table_redesign_plans`, `client_invites`, `project_estimates`,
  `estimate_items`, `estimate_warnings`, `receipts`, `watcher_alerts`,
  `project_wishlist_items`. This is the bulk of the schema, and every one of
  these tables would need `projects` itself to carry a contractor owner
  before they could be considered isolated — right now a `project_id` foreign
  key provides *project*-level grouping, not *company*-level grouping.
- **Per-user** (correctly scoped to `auth.uid()`, no tenant concern):
  `activity_views`, `recent_project_views`.

**Highest-priority finding**: `projects.client_id` (a single `uuid` FK to
`profiles`) is the *only* ownership concept on the table that holds every
other project-scoped table's parent row. There is no equivalent "which
contractor does this project belong to" column. Every other per-project table
inherits this gap by extension.

---

## 2. RLS policy audit

**Every one of the 52 tables has RLS enabled** — cross-checked by diffing the
set of `CREATE TABLE` statements against the set of `ALTER TABLE ... ENABLE
ROW LEVEL SECURITY` statements across all migrations; zero tables are missing
one. This rules out the task's explicit first-priority failure mode.

**But RLS enforces *role*, not *tenant ownership*, everywhere.** The
overwhelmingly dominant policy pattern, present on essentially every
admin/crew-facing table, is:

```sql
USING (get_my_role() = ANY (ARRAY['admin','crew']))
```

`get_my_role()` (current definition, `supabase/migrations/20260607222134_...sql`)
returns the caller's own role from `profiles` — nothing about which company
they belong to, because that concept doesn't exist. This means: **any user
whose `profiles.role` is `'admin'` or `'crew'` — regardless of which
"contractor" they'd conceptually belong to in a multi-tenant world — passes
every one of these checks identically.** There is no second contractor's admin
who would be denied by any of these policies; the policies have no way to even
express that distinction today.

**`auth.jwt()` claims — checked against the class of mistake already found in
`use-auth.ts`:** I traced every RLS policy using `auth.jwt()` (all on
`profiles`, via the "Admins can view all profiles" policy's history):
- **Currently**: `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` — safe,
  `app_metadata` is not client-writable (fixed in migration
  `20260608001656_fix_rls_use_app_metadata_not_user_metadata.sql`, already
  found and addressed earlier in this project's history).
- **Worth noting for the historical record**: migration
  `20260607222134_fix_get_my_role_security_definer_rpc_exposure.sql` — while
  fixing an unrelated issue (a `SECURITY DEFINER` RPC exposure) — briefly
  *reintroduced* the exact `user_metadata`-trust bug on this same policy,
  before the very next migration fixed it back to `app_metadata`. Not a live
  issue today, but a second data point (beyond `use-auth.ts`) that this class
  of mistake has recurred more than once in this codebase's history, worth
  keeping in mind as a review checklist item for any *new* RLS policy written
  for the entitlement system.
- **A genuinely separate, more serious instance of the same class of mistake**,
  not itself an RLS policy but adjacent enough to flag prominently: the
  `handle_new_user()` trigger (`20260526172848_01_users_and_tenant.sql:123-136`)
  sets `profiles.role` directly from `NEW.raw_user_meta_data->>'role'` —
  i.e., **`user_metadata`** — at signup time:
  ```sql
  COALESCE(NEW.raw_user_meta_data->>'role', 'crew')
  ```
  If self-signup is reachable at all (worth confirming — I did not find a
  public signup route in `src/pages/`, only invite-based `AcceptInvite.tsx`
  and `Login.tsx`, so this may currently be unreachable via the UI), any
  account created via `supabase.auth.signUp({ options: { data: { role:
  "admin" } } })` — a standard, documented Supabase client call — would get
  `profiles.role = 'admin'` written directly into the database at row-creation
  time. That row would then also get synced into `app_metadata.role` by the
  *other* trigger (`sync_profile_role_to_app_metadata`), making the
  escalation "stick" through the very mechanism that was built to prevent
  exactly this. **This is a real, live gap regardless of the tenancy
  question** — flagged for fixing, not touched, per the read-only scope of
  this audit.

**Policies that look copy-pasted with a wrong reference**: none found. The
pattern is extremely repetitive (by design — see the mechanical, table-by-table
`DROP POLICY` / `CREATE POLICY` structure of
`fix_all_rls_policies_use_get_my_role.sql`), but every policy I checked
references its own table's actual FK chain correctly (e.g., `canvas_elements`'
client-view policy correctly joins `planning_boards` → `projects` →
`client_id`, not some other table's chain).

**Two concrete, currently-live vulnerabilities found along the way** (not
tenancy issues, but the same "RLS says one thing, app assumes another" class
the brief asked about):

1. **`client_invites` anonymous SELECT policy has no token predicate.**
   ```sql
   CREATE POLICY "Anyone can read invite by token for accept flow"
     ON client_invites FOR SELECT TO anon
     USING (status = 'pending' AND expires_at > now());
   ```
   (`20260526173141_06_operations_and_media.sql:351-354`, never revisited by a
   later migration.) This policy allows any unauthenticated request to read
   **every** pending invite system-wide — `first_name, last_name, email, role,
   status, project_id` — not just the one matching a given token. The
   application (`src/pages/AcceptInvite.tsx:39-41`) always adds
   `.eq("token", params.token)` to its own query, which is why this isn't
   visible through normal use of the app — but that filter is enforced only by
   the client, not by RLS. Anyone with the public anon key (which ships in
   the client bundle, by design) can call the Supabase REST API directly with
   no token filter and get the full list. **Compare this to
   `get_public_presentation()`** (§ below), which does the equivalent
   token-resolution correctly, entirely server-side — the difference between
   the two is the clearest illustration in this codebase of the exact failure
   mode the brief asked me to look for.

   **✅ FIXED** (`supabase/migrations/20260818120000_fix_client_invites_anon_select_token_scope.sql`).
   Dropped the policy; replaced anon access with a token-scoped `SECURITY
   DEFINER` RPC, `get_invite_by_token(p_token text)`, mirroring
   `get_public_presentation()` exactly. `AcceptInvite.tsx` now calls the RPC
   instead of querying the table directly.

   **Verification evidence** — built a local RLS test harness (embedded
   Postgres via `@electric-sql/pglite`, with faithful reproductions of
   Supabase's real `auth.uid()`/`auth.jwt()` helpers and the `anon`/
   `authenticated` roles) and applied the real policy text before and after:
   - **Before fix, confirmed the leak for real**: as `anon`, zero JWT claims,
     querying `client_invites` with no token filter returned **2 unrelated
     invites** (Alice's and Bob's, for two different projects) — not zero,
     not one.
   - **After fix, test 1** — identical unscoped anon query against the raw
     table: **0 rows** (RLS now default-denies; there's no anon table
     policy left at all).
   - **Test 2** — `get_invite_by_token('victim-token-abc123')` (correct
     token): returns exactly that one invite's data (`alice@example.com`,
     `project_id: 101`), nothing else.
   - **Test 3** — `get_invite_by_token('totally-made-up-garbage-token')`
     (wrong token): returns `NULL`.
   - **Test 4** — `get_invite_by_token('expired-token-old111')` (valid
     token, but expired): also returns `NULL` — indistinguishable from a
     wrong token, as required.
   - **Test 5** — `get_invite_by_token('another-token-xyz789')` (a
     *different* real, valid invite's token): returns Bob's data only,
     confirming per-invite isolation, not just "any real token works."
   - **Test 6** — simulated `AcceptInvite.tsx`'s actual real flow end-to-end
     with a valid token: the RPC's returned shape
     (`first_name`/`last_name`/`email`/`role`/`status`/`project_id`) matches
     exactly what the component reads, confirming the fix doesn't break the
     real invite-acceptance UI.
   - All 6 assertions passed. Separately confirmed: `npx tsc -b` clean,
     `npm run build` clean, `npx eslint` on the touched files shows the same
     pre-existing issue count as the original files (verified via
     `git stash` + re-lint), zero new issues introduced.

2. **Storage bucket policies allow any authenticated user to modify/delete
   any file in the shared bucket.**
   ```sql
   CREATE POLICY "Authenticated users can update assets"
     ON storage.objects FOR UPDATE TO authenticated
     USING (bucket_id = 'project-assets');
   CREATE POLICY "Authenticated users can delete assets"
     ON storage.objects FOR DELETE TO authenticated
     USING (bucket_id = 'project-assets');
   ```
   (`20260608003622_create_project_assets_storage_bucket.sql:31-38`.) No
   project or ownership check — any logged-in user, including the
   lowest-privilege `client` role, can delete or overwrite any file belonging
   to any other project. The migration's own comment admits the real
   intent: *"Authenticated users can delete objects (admins/crew only in
   practice via app logic)"* — a direct, self-documented instance of relying
   on client-side UI restriction instead of RLS enforcement.

   **✅ FIXED** (`supabase/migrations/20260818120100_fix_storage_objects_update_delete_ownership.sql`).
   Note on approach: true per-project scoping isn't achievable here — the
   upload path convention (`uploads/{timestamp}_{random}.{ext}`, see
   `src/hooks/use-upload.ts`) carries no project or user identifier at all,
   so there's nothing in the existing path/schema to scope by per-project
   without also changing the upload convention (a larger change, out of
   scope for this fix). The minimal real fix using data that already
   exists: Supabase Storage sets `storage.objects.owner` to the uploader's
   `auth.uid()` automatically at upload time. Both policies now require
   `owner = auth.uid() OR get_my_role() IN ('admin','crew')` — matching the
   admin/crew access pattern used on every other table in this schema.

   **Verification evidence** — same local RLS harness, minimal
   `storage.objects` shape (`bucket_id`, `name`, `owner`) plus `profiles`/
   `get_my_role()`:
   - **Before fix, confirmed for real**: as an authenticated `client`-role
     user, `DELETE FROM storage.objects WHERE name = '<a file owned by a
     completely different user>'` **succeeded** (1 row deleted).
   - **After fix, test 1** — identical attack: **0 rows deleted**, blocked.
   - **Test 2** — the same `client` user deleting **their own** file:
     still succeeds (1 row) — confirms the fix doesn't break legitimate
     self-service deletion.
   - **Test 3** — an `admin`-role user deleting a file owned by someone
     else entirely: still succeeds (1 row) — confirms admin/crew retain
     full management rights, unchanged from before.
   - **Test 4** — `client` attempting an `UPDATE` (rename) on a file they
     don't own: **0 rows updated**, blocked.
   - **Test 5** — a user with no `profiles` row at all (role lookup
     returns `NULL`) attempting to delete someone else's file: blocked,
     confirming the `NULL`-role edge case doesn't accidentally fall through
     to "allowed."
   - All 5 assertions passed. Same `tsc -b`/`build`/lint clean-diff
     verification as above (this fix is SQL-only, no application code
     touched).

---

## 3. Application-layer assumptions

- **Hardcoded single-tenant key**: `src/hooks/use-tenant-brand.ts:27` —
  `.eq("tenant_key", "default")`. This is the clearest single piece of
  evidence that the frontend has never had to think about "which tenant is
  this user in" — it's baked into the query as a literal string.
- **No `contractor`/`company` concept anywhere in the frontend** — grepped all
  of `src/**/*.{ts,tsx}` for `contractor|tenant|company`; every real hit is
  either `tenant_settings`/`tenant_key` (the single-row config table above),
  `useTenantBrand`, or `designer-suppliers.ts`/`CrewAndTrade.tsx`'s use of
  "company" as a free-text field name on subcontractor/supplier records
  (a person's business name, not an isolation boundary).
- **Missing filters relied on as RLS-redundant, but not actually enforced**:
  the `client_invites` case above (§2) is the clearest example — the app's
  `.eq("token", ...)` *looks* redundant with server-side enforcement but
  isn't.
- **Cross-project write gap** (not contractor-related, but a real project
  boundary gap worth noting since it's the same failure category): 
  `project_wishlist_items`'s insert policy
  (`20260608014625_create_project_wishlist_items.sql:23-26`) only checks
  `auth.uid() = user_id` — it never verifies the inserting user actually has
  access to the `project_id` they're writing into. Any authenticated user
  (including a `client` on Project X) could insert a wishlist row against
  Project Y's `project_id`. Lower severity than the two §2 findings (they
  couldn't *read* Project Y's data this way, just write noise into it), but
  the same missing-check shape.
- **"Current contractor" is never determined anywhere** — there's no
  equivalent question to answer for "is it derived server-side or passed as a
  tamperable prop," because the concept doesn't exist in the app at all. The
  closest analogue, "current project," *is* derived properly: every
  project-scoped page reads `project_id` from the route (`useParams()`) and
  relies on RLS to reject unauthorized reads — which works correctly today
  because RLS's project-scoping (via `client_id`) is real, even though its
  *contractor*-scoping isn't.

**Edge Functions**: all 9 checked. Every function that touches privileged data
(`estimate-auditor`, `estimate-generator`, `estimate-client-reviewer`,
`generate-social-post`, `project-watcher`, `parse-receipt`) follows the same
correct pattern — verify the JWT via `auth.getUser(token)`, look up
`profiles.role` (falling back to `app_metadata.role`, matching the fix already
applied elsewhere), reject non-admins with 403 — before using the service-role
key for the actual DB work. `board-prompt` and `design-critique` verify auth
but skip the role check; that's fine, since neither one independently queries
the database with the service-role key — they only process board
context/prompts the client already had legitimate (RLS-scoped) access to see.

**The gap that matters for the entitlement design**: every admin-gated
function accepts `project_id` directly from the client request body and,
after confirming the caller is *some* admin, immediately operates on that
project with the service-role key — which bypasses RLS entirely. Concretely,
in `estimate-generator/index.ts:60-99`:
```ts
const role = (profile as any)?.role ?? userData.user.app_metadata?.role ?? null;
if (role !== "admin") { /* 403 */ }
...
const projectId = body.project_id;  // <- straight from the client
...
const { data: project } = await db.from("projects").select(...).eq("id", projectId)...
```
There is no check that this admin's contractor (once that concept exists)
owns `projectId`. This is invisible today because every admin already has
blanket access to every project. **This is the single most important
code-level finding for the entitlement design**: RLS-bypass functions like
this one will need an explicit contractor-ownership check added at the
function level — a role check alone will not be sufficient once "admin" no
longer implies "admin of the only company that exists."

---

## 4. Concrete attack scenarios

**Scenario A — the core tenancy gap (hypothetical: what happens the day a
second contractor is onboarded with zero other changes).** Contractor B signs
up, gets an `admin` account. They log into the exact same app at
`project.asterandspruceliving.ca`, click into the ordinary Dashboard. The
`projects` RLS policy (`"Admins and crew can view all projects"`) returns
every project row in the table — Contractor A's client names, addresses,
budgets, everything. They open any of Contractor A's estimates
(`project_estimates`/`estimate_items`, admin-only but role-only, not
company-scoped) and see Contractor A's markup percentages and management fee
structure. They open Supplier Prices and see Contractor A's entire negotiated
pricing book (`supplier_prices`, `crew_rates`, `subcontractors`) — this is
Contractor A's most commercially sensitive data, fully visible to a
competitor, with zero exploit required — this is what the app does by design
today for any two admins.

**Scenario B — ✅ FIXED, was live prior to 2026-08-18.** Anyone with the public
Supabase anon key (visible in any browser's network tab or page source — it's
meant to be public) sends:
```
GET /rest/v1/client_invites?select=first_name,last_name,email,phone,project_id&status=eq.pending
Authorization: Bearer <anon key>
```
No login required. This returns the name, email, and phone number of every
person currently sitting on a pending invite across the whole app — a direct
PII leak, unrelated to the tenancy question but surfaced by this audit —
now closed by `get_invite_by_token()`; this exact query returns nothing
after the fix.

**Scenario C — ✅ FIXED, was live prior to 2026-08-18.** A signed-in `client` user
(the lowest-privilege role, meant to only view their own single project) opens
their browser console and runs:
```js
await supabase.storage.from('project-assets').remove(['<any-other-projects-photo-path>.jpg'])
```
This succeeded — `storage.objects`' DELETE policy checked only `bucket_id =
'project-assets'`, nothing about which project the caller belongs to. A
disgruntled or merely curious client of Project X could delete or overwrite
photos, documents, and avatars belonging to Project Y. Now fixed for exactly
this case (non-owner, non-admin/crew callers are blocked). **Caveat**: this
fix does not, and wasn't intended to, close the broader tenancy gap —
`admin`/`crew` are still global roles, so once a second contractor exists,
its admins would still be able to manage any file via the
`get_my_role() IN ('admin','crew')` clause, same as every other table in
this schema. That's correctly part of the larger multi-tenancy work in §5
items 1-4, not this fix.

---

## 5. Prioritized fix list

Ranked by real damage if left alone vs. cost to fix — same framing as the
earlier code audit. **Nothing here has been implemented; this is read-only.**

**Must fix before any multi-tenant entitlement work starts (structural,
not quick):**
1. **Add a `contractors` table and a `contractor_id` FK to `projects`**
   (and by extension, decide how every per-project table inherits scoping —
   either duplicate the FK or always join through `projects`). This is the
   root fix everything else depends on; there is no way to build a safe
   entitlement layer without it.
2. **Add contractor scoping to every "global" table that's actually
   proprietary per-contractor data**: `cost_categories`, `market_rates`,
   `crew_rates`, `subcontractors`, `suppliers`, `supplier_prices`,
   `material_price_history`, `regional_modifiers`, `estimate_assemblies`,
   `assembly_materials`. Right now these are shared fixtures across "the
   company" — in a multi-tenant world they need to become per-contractor
   or the pricing-book leak in Scenario A persists even after `projects`
   gets scoped.
3. **Rewrite every RLS policy currently checking only `get_my_role() IN
   ('admin','crew')` to also join through to a contractor match** — this is
   the bulk of the ~150+ individual `CREATE POLICY` statements in this
   schema. Mechanical but large; probably worth a codegen/templating
   approach given how repetitive the current pattern already is.
4. **Add contractor-ownership checks to every Edge Function that accepts a
   client-supplied `project_id`** (`estimate-auditor`, `estimate-generator`,
   `estimate-client-reviewer`, `generate-social-post`, `project-watcher`,
   `parse-receipt`) — role check alone is insufficient once "admin" can mean
   "admin of a different company."

**Quick, independent fixes — not blocking on the tenancy work, worth doing
regardless of when entitlements ship:**
5. ~~**Fix the `client_invites` anonymous SELECT policy**~~ — **✅ FIXED**,
   see §2/§4 for the migration and full verification evidence.
6. ~~**Fix the storage bucket UPDATE/DELETE policies**~~ — **✅ FIXED**,
   see §2/§4 for the migration and full verification evidence.
7. **Fix `handle_new_user()`** to not trust `raw_user_meta_data->>'role'` at
   all — default every new signup to `'crew'` (or whatever the lowest
   privilege is) and require an explicit admin action to grant elevated
   roles, rather than trusting client-supplied signup metadata. Worth first
   confirming whether self-signup is reachable in the current UI at all
   (I did not find a public signup route, only invite-based onboarding) —
   if it's genuinely unreachable, this is lower urgency but still worth
   closing defensively.
8. **Fix `project_wishlist_items`'s INSERT policy** to also verify the
   inserting user has legitimate access to the target `project_id` (mirror
   the pattern already used correctly on `messages`' INSERT policy).

**Not urgent, just noted:**
9. `tenant_settings`/`feature_flags`'s vestigial `tenant_key` column is
   either the seed of the real entitlement mechanism (repurpose it once
   `contractors` exists) or dead weight to clean up — worth a deliberate
   decision rather than leaving it ambiguous once the real contractor
   concept lands.

## Open question for you

Given fix #1-#4 above are genuinely substantial (a new table, scoping ~40
tables' worth of RLS policies, updating 6 Edge Functions), it's worth
confirming before any of that work starts: is the entitlement system meant to
support **fully isolated contractor accounts** (what this report assumes, and
what "Contractor A shouldn't see Contractor B's data" implies), or a lighter
**single-company, per-user feature-gating** model (closer to what
`feature_flags` already half-supports) where "contractor" really means
"toggle which parts of the app one company's admins/crew/clients can reach,"
not true data isolation between separate companies? The fix list above is
sized for the former; the latter would be a much smaller, `feature_flags`-only
change.
