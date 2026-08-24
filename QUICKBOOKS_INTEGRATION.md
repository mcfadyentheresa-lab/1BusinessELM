# QuickBooks Integration — Scoping Doc

Started 2026-08-23, prompted by a question while testing the new client-facing
estimate summary card (ESTIMATE_AUDIT.md item 8): should that card link out to
something more substantial than a total and a list of rooms?

**Status: not started, not sized, no decision made.** This document exists so
that decision can be made deliberately, the same way the multi-tenancy work in
`TENANCY_AUDIT.md` and the "own product" question in `ESTIMATE_AUDIT.md` item 14
were — written down and revisited when there's an actual trigger to act on it,
not built speculatively.

---

## 1. Why this came up

The client-facing estimate card (`get_client_estimate_summary`) intentionally
shows only a total, an approval date, and the rooms covered — no per-item
breakdown, by deliberate design (§ ESTIMATE_AUDIT.md item 8). While reviewing
that card, the app's owner raised: clients get real estimates through
**QuickBooks today, regularly** — not through ELM. That's a more fundamental
fact than "the card is thin." It means two systems can independently hold "the
estimate" for the same job, and only one of them is what the client actually
sees and acts on.

## 2. Current state of the two systems

**ELM's estimate tool** (this repo, `CostEstimator.tsx` + the
`project_estimates`/`estimate_items` tables): a *planning* tool. It has
category-based cost rates, market-rate guidance, reusable assemblies, and a
markup/contingency/management-fee calculation chain — none of which QuickBooks
has a direct equivalent for. This engagement just spent significant effort
making it reliable: atomic saves, input validation, a real approve/lock/unlock
flow with an audit trail, and automated test coverage (ESTIMATE_AUDIT.md items
9-13). That work is not wasted regardless of what happens with QuickBooks —
it's the tool for figuring out the number.

**QuickBooks**: where the app's owner already creates and sends the estimate a
client actually receives and acts on, today, as an existing real workflow —
confirmed directly, not assumed. ELM has zero QuickBooks integration currently
— no OAuth setup, no API calls, no stored credentials, nothing in
`supabase/functions/` or `src/` references QuickBooks at all.

**The gap this creates**: an admin can plan and approve an estimate inside ELM,
and separately create a same-or-different number in QuickBooks for the actual
client-facing document — two sources of truth, no link between them, and
nothing stopping them from drifting apart.

## 3. The real architectural question

Not "should the card link somewhere" but: **which system is the source of
truth for what a client sees?** Three shapes this could take:

**Option A — QuickBooks becomes the client-facing source of truth.**
ELM's tool stays purely internal (planning, scoping, getting to a number).
Once an admin creates the real estimate in QuickBooks, that QuickBooks estimate
gets linked to the ELM project, and the client-facing card pulls live from
QuickBooks via its API instead of (or in addition to) `get_client_estimate_summary`.
Smallest change to the admin's actual daily workflow, since QuickBooks usage
doesn't change — ELM just becomes aware of what already exists there.

**Option B — Replace ELM's estimate system with QuickBooks entirely.**
Stop maintaining separate line-item/markup logic in ELM; treat QuickBooks as
the only estimate tool, end to end. Throws away the category-rate/market-rate/
assembly tooling that has real standalone value, and is a much bigger, more
disruptive change to how admin actually works today. Not recommended without a
specific reason to prefer it over Option A.

**Option C — Status quo, no integration.**
Keep the two systems fully separate and manual, as they are today. The
client-facing summary card already ships and works (ESTIMATE_AUDIT.md item 8);
this option just means accepting the two-sources-of-truth risk rather than
solving it. Valid if the drift risk in practice is low (e.g., if the ELM
number is only ever a rough internal check and QuickBooks is always what
actually goes to the client) — but that's a real thing to confirm, not assume.

**Recommendation for whenever this gets built: Option A.** It respects the
tool that's already reliable (ELM's planning math) and the workflow that's
already real (QuickBooks for the client-facing document), rather than
replacing either.

## 4. What Option A would actually require

**Authorization**: QuickBooks Online's API uses OAuth 2.0 (authorization-code
flow) via Intuit's developer platform. Requires registering a "connected app"
with Intuit, a sandbox environment for development separate from the real
production QuickBooks company, and handling token lifecycle — access tokens
expire in ~1 hour, refresh tokens rotate and expire in ~100 days, so this needs
real refresh-token handling, not a one-time setup. Tokens are full-scope
accounting credentials and must never reach the client — server-side only,
stored the way Supabase Secrets already stores other sensitive values in this
project (matches the pattern already used for other Edge Function credentials).

**Linking a QuickBooks estimate to an ELM project**: needs new columns (e.g.
`project_estimates.quickbooks_estimate_id`, and a realm/company ID somewhere —
probably `tenant_settings`, since QuickBooks scopes data per company/realm, and
this app is currently single-tenant per `TENANCY_AUDIT.md`). Open product
question: does admin manually paste in a QuickBooks estimate number, or is
there a picker UI that lists recent QuickBooks estimates to attach? The former
is far cheaper to build; the latter is nicer but needs a QuickBooks
list/search API call and UI work.

**Fetching the data**: a new Edge Function (matching the existing pattern —
`estimate-auditor`, `estimate-client-reviewer`, etc. — and the
`SECURITY DEFINER` RPC pattern used for `get_client_estimate_summary`) that
calls QuickBooks' API server-side and returns only the client-safe subset,
never the raw QuickBooks payload. Live-fetch-on-view is the simplest and
safest option — avoids a stale cached copy silently disagreeing with
QuickBooks, which is exactly the class of bug this engagement has spent most
of its time eliminating elsewhere. A webhook-based push model (QuickBooks
notifies ELM when an estimate changes) is more real-time but needs a public
verifiable webhook endpoint and is meaningfully more complex — not a first-
version concern.

**Failure handling**: QuickBooks API being down, a token expiring and refresh
failing, or no QuickBooks estimate ever having been linked all need graceful
degradation — falling back to ELM's own `get_client_estimate_summary` data (or
a plain "estimate details are being finalized" state), never a hard error on
the client's Overview tab.

## 5. Open questions to decide before this is built

1. Does the client stay inside ELM to see estimate detail (pulled from
   QuickBooks via API), or does the card instead hand off to QuickBooks'
   own customer-facing estimate view? These are different builds — the first
   needs the full API-fetch pattern above; the second is closer to Option C
   plus a link, with QuickBooks handling its own client-facing security.
2. Manual linking (admin pastes a QuickBooks estimate ID) vs. a picker UI —
   cost/value tradeoff, not a technical blocker either way.
3. Does this ever need to go two-way (ELM writing to QuickBooks), or is
   read-only (QuickBooks → ELM) sufficient? Read-only is significantly safer
   and simpler, and nothing in the current framing needs write access.
4. Single QuickBooks company assumed — confirm that's actually true for this
   business today and isn't expected to change.
5. Scope: estimates only, or does this open the door to invoices/payments
   later? Worth naming now even if only estimates are in scope for a first
   version, since it affects how narrowly the Edge Function/data model should
   be built.

## 6. Sequencing recommendation, if/when this moves forward

Not urgent — no specific deadline or committed client-facing need surfaced
this conversation. If and when it's picked up:

1. Answer the open questions in §5 first — they change the shape of the build,
   not just its size.
2. Manual-link + read-only + live-fetch-on-view is the smallest real version
   of Option A. Build that before considering a picker UI or webhooks.
3. Reuse the existing `SECURITY DEFINER`/Edge-Function patterns already
   established in this codebase rather than inventing a new one.
