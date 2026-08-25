# Muskoka Pricing Research — Plan + First Pass

Started 2026-08-24, prompted by the app's owner sharing an existing ChatGPT
research report ("Builder Markup and Cost-Plus Fees for High-End Cottage
Projects in Muskoka") and asking for a second-opinion research plan against
it, covering both the markup/fee structure that report addresses and the
separately-flagged stale `market_rates` table.

## What already exists

**The owner's ChatGPT report** substantiates the "20%-35% blended markup,
25% sustainable default" claim already baked into `CostEstimator.tsx`'s
markup tooltip (previously flagged in this engagement as an unverified
citation — it isn't fabricated, it traces to this report). Its own
strongest evidence is genuine Muskoka-builder proposal disclosures (cost-
plus is described as "very typical in Muskoka," markup applied to
materials/subs/labour and sometimes permits/engineering). Its weakest
evidence — and the report says so itself, repeatedly — is generic or
adjacent-market pricing guides (GTA, Calgary, US remote-site architecture)
extrapolated onto Muskoka, explicitly flagged in the source as "vendor-
published, treat as directional" or "illustrative only, not normative."

**`market_rates`** (15 categories: Bathroom/Kitchen Renovation, Cabinet
Painting, Carpentry-Custom/Trim, Deck & Outdoor, Drywall, Electrical-
Fixture, Flooring-Hardwood/Tile, General Labour, Painting-Interior/
Exterior, Plumbing-Fixture, Wallpaper Installation) is dated `2024-01-01`
across every row — flagged during the estimate-area audit as stale but not
corrected then, since (unlike a government fee schedule) there's no single
authoritative source for a contractor labour rate.

## Research plan

**Principle**: don't re-derive what's already reasonably solid. Target the
specific weak points, and be honest about what's verifiable-with-
confidence (a published rate card, a trade association's own numbers)
versus what's inherently a range no search can resolve to one "correct"
number.

### Track A — Markup/fee structure (validate the existing report)

Priority order, weakest claims first:

1. **The 20%-35% "sustainable blended markup" range itself** — the report's
   own math for this (12% overhead + 8% profit → 25% markup) is sound
   arithmetic, but the 12%/8% inputs are generic profitability references,
   not Muskoka-specific. Look for: Ontario Home Builders' Association
   guidance, a Muskoka-region contractors' association if one exists, or
   direct disclosures from 2-3 real Muskoka renovation/custom-cottage
   builders (public proposals, published FAQ/pricing pages) rather than
   aggregated GTA/Calgary comparisons.
2. **Island/water-access premium (10%-25%)** — sourced to one "current
   Muskoka pricing guide" in the report. Worth finding a second independent
   source before treating this as solid; barge rate cards (the report's
   Sopher's Landing/Carveth's Marina examples) are genuinely verifiable
   primary data and worth confirming are still current.
3. **Per-cost-bucket markup ranges (materials 10-35%, subs 10-25%, etc.)**
   — reasonable as *ranges* (they're wide enough to be hard to falsify),
   lower priority to re-verify than the headline blended number actually
   driving the app's default.

### Track B — `market_rates` (the stale per-category table)

Not verifiable against one authoritative source the way a permit fee is —
contractor rates are real ranges, not a published schedule. The
useful bar here isn't "prove the exact number," it's "confirm the current
values are still a plausible 2026 Ontario/Muskoka range, and flag any that
look clearly stale (e.g. off by an inflation-implausible margin from a
current, reputable cost guide)."

Approach: find 2-3 current (2025-2026) Ontario renovation cost-per-unit
guides that cover multiple categories at once (these tend to bundle
several trades per article), cross-reference against each of the 15
stored categories, and flag material discrepancies rather than replace
every number outright.

## First-pass findings (2026-08-24)

Executed directly (WebSearch/WebFetch), not delegated — see below for what
was checked and the resulting confidence per item. Nothing here has been
applied to the app yet; these are findings for the owner to weigh in on,
consistent with the principle above that pricing judgment calls are the
owner's decision.

### Track A — Markup/fee structure

**1. The 20%-35% blended markup range — a real, credible disagreement found.**

Two independent lines of evidence pull in different directions:

- General renovation-industry sources (OHBA-adjacent guidance, contractor
  pricing explainers) converge on roughly 20-30% as "standard" markup,
  broadly consistent with the existing report and the app's 25% default.
- [Canadian Contractor magazine](https://www.canadiancontractor.ca/voices/the-profit-series-part-2-markup-and-margin/)
  — a real Canadian trade publication, not a vendor or lead-gen site — runs
  a worked example landing at **~43% markup**, built on a "Rule of One
  Third" (materials/labour, overhead, and profit each get roughly equal
  thirds of the price), which implies a *minimum* 33% gross margin —
  equivalent to roughly **49-50% markup** at the low end of what they
  consider sustainable.

This is a genuine split between credible sources, not something a search
can resolve to one "correct" number. The Canadian Contractor figure is
notably higher than both the existing report's 20-35% range and the app's
25% default. **Flagging for the owner's judgment**: whether to leave the
default as-is (it's still defensible — it's the lower end of a real range,
not fabricated), add a note acknowledging the wider range some trade
sources cite, or raise the default/upper bound. No code change made
pending that decision.

**2. Island/water-access premium (10-25%) and barge rate cards** — not
re-verified this pass; lower priority per the plan, and the report's own
sourcing (direct marina/barge operator rate cards) is about as primary as
this gets. No search substitute is more authoritative than the operators'
own current rates, so this would need a direct check with Sopher's Landing
/ Carveth's Marina rather than a web search — not done here.

**3. A genuine primary Muskoka-specific published markup percentage** —
searched for directly; **none found**. Several real Muskoka builders using
cost-plus contracts were identified by name (e.g. Classic Muskoka Homes),
confirming cost-plus is genuinely common practice in the region as the
existing report claims, but none publish an exact percentage — which
matches what the original report itself already said. This isn't a gap
search can close: the only way to get a genuine Muskoka-specific number
would be asking builders directly, which is the owner's call to pursue or
not.

### Track B — `market_rates` (stale 2024-01-01 table)

Cross-referenced against current (2026) Ontario cost guides gathered via
[Sensodesign](https://sensodesign.ca/home-renovation-cost-in-toronto/),
[patchdudes.com](https://patchdudes.com/drywall-cost-per-square-foot-ontario/),
[petunflooring.ca](https://petunflooring.ca/flooring-cost-in-ontario-2026-a-price-guide-by-material-and-installation/),
[blackwoodkitchens.ca](https://blackwoodkitchens.ca/bathroom-renovation-cost-ontario/) /
[blackwoodkitchens.ca kitchen guide](https://blackwoodkitchens.ca/kitchen-renovation-cost-ontario/),
and trade-rate guides via [fixyflow.com](https://fixyflow.com/blog/plumber-hourly-rate-2026)
and [Grizzli](https://grizzli.app/blog/electrician-charges-per-hour-ontario):

| Category | Stored (2024-01-01) | 2026 guide range | Verdict |
|---|---|---|---|
| Painting - Interior | $1.50-3.50/sqft | $2-4/sqft (walls); $3-5 w/ ceiling+trim | Bottom end slightly low; roughly consistent |
| Painting - Exterior | $2.00-5.00/sqft | No direct 2026 figure found | Not re-verified |
| Drywall | $3.00-7.00/sqft | $2.00-4.50+/sqft supply+install | Consistent, top end slightly high but plausible |
| Flooring - Hardwood | $6.00-14.00/sqft (labour only) | $2-7/sqft installation portion of a $1-14 blended range | Scope mismatch (labour-only vs. blended quote) makes direct comparison unreliable — not clearly wrong, just not cleanly comparable |
| Flooring - Tile | $8.00-20.00/sqft (labour only) | Not split out separately in guides found | Not re-verified |
| Kitchen Renovation | $175-400/sqft (typical 275) | $20k-65k total, median $55k; ÷~175sqft typical kitchen ≈ $314/sqft | Consistent with mid-range figure |
| Bathroom Renovation | $150-350/sqft (typical 225) | GTA average ~$14,800 total ÷~50sqft ≈ $296/sqft; luxury gut $50k+ ÷50sqft ≈ $1,000/sqft (outlier) | Consistent for typical/mid-range scope |
| Electrical - Fixture | $90-130/hr | $90-130/hr average; up to $200/hr in Toronto core | Consistent — stored range matches the (non-urban-core) average |
| Plumbing - Fixture | $95-145/hr | Journeyman $115-160/hr province-wide; master plumber $150-200/hr | **Stale — stored range now sits below current provincial rates on both ends** |
| Cabinet Painting, Wallpaper, Carpentry (Trim/Custom), Deck & Outdoor, General Labour | — | Not checked this pass | Not re-verified |

**One clear, actionable finding**: `Plumbing - Fixture` ($95.00-$145.00,
typical $115.00) looks genuinely stale against current 2026 provincial
guides, which put journeyman residential rates at $115-160/hr and master
plumbers at $150-200/hr. Unlike the markup-percentage question, this is
closer to a real market-rate check (multiple independent trade-rate guides
converge on the higher range) rather than a business-judgment call — worth
the owner's sign-off to update, but not changed here without that.

The remaining categories were not checked this pass (diminishing returns —
each additional category requires its own targeted search, and the ones
checked so far didn't surface a pattern of broad staleness beyond
plumbing). If useful, a follow-up pass could specifically target Cabinet
Painting, Wallpaper, Carpentry, Deck & Outdoor, and General Labour.

### Summary — what this second opinion actually changed

Nothing in the app was changed by this research pass. Two items are ready
for the owner's decision:

1. **Markup default/range** — leave at 25%/20-35%, or acknowledge the
   wider range Canadian Contractor cites (up to ~43-50%).
2. **Plumbing - Fixture rate** — update from $95-145/hr to something closer
   to $115-160/hr (journeyman) to match current provincial guides.

Everything else researched either confirmed the existing data was still
reasonable, or wasn't conclusively resolvable by search (Track A items 2
and 3, and the un-checked Track B categories).
