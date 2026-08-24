/*
  # Correct stale Muskoka pricing data, verified against primary sources

  ## Problem
  Full audit requested by the app's owner: verify estimate reliability and
  the accuracy of Muskoka-specific pricing data. Found that all 8
  regional_modifiers rows had last_verified and source_url both NULL,
  despite descriptions asserting specific real-world sourcing (e.g. "CRA
  mileage rate...(2024)", "Consistent with documented Muskoka island-access
  premium") - the sourcing was prose-only, never actually tracked, and
  three of the eight rows turned out to be genuinely stale when checked
  against current (2026) primary sources:

  1. CRA mileage rate: stored $0.65/km. The actual 2026 CRA rate (effective
     Jan 1, 2026) is $0.73/km for the first 5,000 km - about 11% higher.
     Source: CRA automobile allowance rate announcement, corroborated by
     multiple mileage-tracking services reporting the same figure.

  2. Town of Huntsville building permit: stored $12.50/$1,000, minimum $150.
     The Town's own building permits page states the current rate is
     $11.00 per $1,000, minimum $125 - both figures were too high.
     Source: https://www.huntsville.ca/business-development-environment/building-and-renovating/building-permits/

  3. Township of Muskoka Lakes building permit: the $11.00/$1,000 rate was
     correct, but the stored minimum ($120 flat) doesn't match the real
     formula. Per the Township's own fee schedule (Schedule "H", By-law
     2023-109, effective March 12, 2025): minimum is $1.55/sq ft of
     finished floor area OR $200, whichever is greater - not a $120 flat
     minimum.
     Source: https://www.muskokalakes.ca/media/nw3l4j5v/schedule-h.pdf

  ## Scope note
  The other 5 regional_modifiers rows (season/boat-access/heritage/remote
  surcharge percentages, crew accommodation per diem) are left untouched.
  Unlike a government fee schedule or the CRA's published rate, these are
  business judgment calls with no single authoritative source to verify
  them against - correcting them from search results would risk replacing
  the app owner's real-world pricing judgment with something less
  reliable, not more. They're still unverified/undated same as before;
  worth the app owner confirming them against current experience rather
  than either of us treating a web search as authoritative for a business
  judgment number.

  market_rates (labour/material typical costs) has the same "dated
  2024-01-01, never revisited" staleness, for the same reason: no single
  authoritative source exists to verify a contractor labour rate against,
  so it isn't corrected here either - flagged in ESTIMATE_AUDIT.md instead
  for the app owner's own judgment.
*/

UPDATE regional_modifiers
SET value = '0.73',
    description = 'CRA mileage rate for travel to/from Huntsville base (2026, effective Jan 1)',
    source_url = 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/benefits-allowances/automobile/automobile-motor-vehicle-allowances/automobile-allowance-rates.html',
    last_verified = '2026-08-24'
WHERE name = 'Travel time - Huntsville base' AND region = 'muskoka';

UPDATE regional_modifiers
SET value = '11.00',
    description = '$11.00 per $1,000 of construction value; minimum $125 (Town of Huntsville building permit fees, current schedule)',
    source_url = 'https://www.huntsville.ca/business-development-environment/building-and-renovating/building-permits/',
    last_verified = '2026-08-24'
WHERE name = 'Town of Huntsville building permit' AND region = 'muskoka';

UPDATE regional_modifiers
SET description = '$11.00 per $1,000 of construction value; minimum is $1.55/sq ft of finished floor area or $200, whichever is greater (Township of Muskoka Lakes Schedule "H", By-law 2023-109, effective Mar 12, 2025)',
    source_url = 'https://www.muskokalakes.ca/media/nw3l4j5v/schedule-h.pdf',
    last_verified = '2026-08-24'
WHERE name = 'Township of Muskoka Lakes building permit' AND region = 'muskoka';
