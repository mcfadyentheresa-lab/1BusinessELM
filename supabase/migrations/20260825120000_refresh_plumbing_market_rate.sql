-- Plumbing - Fixture market_rate was dated 2024-01-01 and running low
-- against current (2026) Ontario provincial guides, which put licensed
-- journeyman residential rates at $115-160/hr and master plumbers at
-- $150-200/hr. This is a reference hint shown next to the line-item cost
-- field, not a price the app charges — refreshing it so the hint stays a
-- useful sanity check against real trade quotes.

UPDATE market_rates
SET
  low_rate = '115.00',
  high_rate = '160.00',
  typical_rate = '135.00',
  effective_date = '2026-08-25',
  notes = 'Licensed plumber, Muskoka area. Journeyman residential rate per 2026 Ontario provincial guides.'
WHERE category_id = (SELECT id FROM cost_categories WHERE name = 'Plumbing - Fixture');
