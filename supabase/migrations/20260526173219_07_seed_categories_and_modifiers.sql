/*
  # Seed: Cost Categories, Market Rates, and Muskoka Regional Modifiers

  Seeds the baseline data needed for the cost estimator to function:
  - 15 renovation work type categories
  - Market rates per category (Muskoka-area pricing)
  - Regional modifiers (surcharges, permit formulas, travel rules)
*/

-- Cost categories
INSERT INTO cost_categories (name, description, default_unit_type, sort_order) VALUES
  ('Painting - Interior', 'Interior wall and ceiling painting', 'sq_ft', 1),
  ('Painting - Exterior', 'Exterior siding, trim, and surface painting', 'sq_ft', 2),
  ('Cabinet Painting', 'Kitchen and bathroom cabinet repainting', 'linear_ft', 3),
  ('Wallpaper Installation', 'Wallpaper hanging and removal', 'sq_ft', 4),
  ('Carpentry - Trim', 'Baseboards, crown moulding, casing installation', 'linear_ft', 5),
  ('Carpentry - Custom', 'Built-ins, shelving, custom millwork', 'hour', 6),
  ('Flooring - Hardwood', 'Hardwood floor installation and refinishing', 'sq_ft', 7),
  ('Flooring - Tile', 'Ceramic, porcelain, natural stone tile', 'sq_ft', 8),
  ('Drywall', 'Drywall installation, taping, mudding', 'sq_ft', 9),
  ('Plumbing - Fixture', 'Fixture supply and installation', 'unit', 10),
  ('Electrical - Fixture', 'Fixture and outlet installation', 'unit', 11),
  ('Kitchen Renovation', 'Full kitchen gut and renovation', 'sq_ft', 12),
  ('Bathroom Renovation', 'Full bathroom gut and renovation', 'sq_ft', 13),
  ('Deck & Outdoor', 'Deck building, staining, repairs', 'sq_ft', 14),
  ('General Labour', 'Hourly general labour and cleanup', 'hour', 15)
ON CONFLICT DO NOTHING;

-- Market rates (Muskoka region, CAD, effective 2024-01-01)
INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'sq_ft', '1.50', '3.50', '2.25', '2024-01-01', 'Per sq ft including prep and two coats'
FROM cost_categories WHERE name = 'Painting - Interior' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'sq_ft', '2.00', '5.00', '3.25', '2024-01-01', 'Per sq ft; includes prime and two finish coats'
FROM cost_categories WHERE name = 'Painting - Exterior' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'linear_ft', '18.00', '35.00', '25.00', '2024-01-01', 'Per linear foot of door/drawer face'
FROM cost_categories WHERE name = 'Cabinet Painting' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'sq_ft', '4.00', '12.00', '7.00', '2024-01-01', 'Install only; material extra'
FROM cost_categories WHERE name = 'Wallpaper Installation' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'linear_ft', '8.00', '18.00', '12.00', '2024-01-01', 'Labour only; material extra'
FROM cost_categories WHERE name = 'Carpentry - Trim' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'hour', '75.00', '120.00', '90.00', '2024-01-01', 'Custom millwork and built-ins, Muskoka area'
FROM cost_categories WHERE name = 'Carpentry - Custom' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'sq_ft', '6.00', '14.00', '9.00', '2024-01-01', 'Install labour only; material extra'
FROM cost_categories WHERE name = 'Flooring - Hardwood' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'sq_ft', '8.00', '20.00', '12.00', '2024-01-01', 'Install labour only; material extra'
FROM cost_categories WHERE name = 'Flooring - Tile' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'sq_ft', '3.00', '7.00', '4.50', '2024-01-01', 'Supply and install, tape and mud included'
FROM cost_categories WHERE name = 'Drywall' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'hour', '95.00', '145.00', '115.00', '2024-01-01', 'Licensed plumber, Muskoka area'
FROM cost_categories WHERE name = 'Plumbing - Fixture' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'hour', '90.00', '130.00', '105.00', '2024-01-01', 'Licensed electrician, Muskoka area'
FROM cost_categories WHERE name = 'Electrical - Fixture' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'sq_ft', '175.00', '400.00', '275.00', '2024-01-01', 'Full gut renovation per sq ft of kitchen'
FROM cost_categories WHERE name = 'Kitchen Renovation' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'sq_ft', '150.00', '350.00', '225.00', '2024-01-01', 'Full gut renovation per sq ft of bathroom'
FROM cost_categories WHERE name = 'Bathroom Renovation' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'sq_ft', '30.00', '75.00', '48.00', '2024-01-01', 'New deck construction, Muskoka area including permit'
FROM cost_categories WHERE name = 'Deck & Outdoor' ON CONFLICT DO NOTHING;

INSERT INTO market_rates (category_id, unit_type, low_rate, high_rate, typical_rate, effective_date, notes)
SELECT id, 'hour', '55.00', '80.00', '65.00', '2024-01-01', 'General labour and cleanup'
FROM cost_categories WHERE name = 'General Labour' ON CONFLICT DO NOTHING;

-- Regional modifiers (Muskoka)
INSERT INTO regional_modifiers (region, modifier_type, name, value, unit, applies_to, description, is_active) VALUES
  ('muskoka', 'surcharge_percent', 'Boat-access cottage premium', '25', 'percent', 'both', 'Properties accessible only by water require barge or helicopter delivery; adds 20-30% to all trades', true),
  ('muskoka', 'surcharge_percent', 'Remote site premium', '15', 'percent', 'both', 'Properties >30 min from Huntsville or Gravenhurst; extra travel and logistics', true),
  ('muskoka', 'season_premium', 'Winter premium (Nov-Mar)', '20', 'percent', 'both', 'Heating, winter driving conditions, reduced crew availability add 15-25%', true),
  ('muskoka', 'surcharge_percent', 'Heritage or log structure', '30', 'percent', 'labour', 'Specialty skills for log, timber frame, or heritage restoration', true),
  ('muskoka', 'permit_formula', 'Township of Muskoka Lakes building permit', '11.00', 'per_thousand_value', 'permit', '$11.00 per $1,000 of construction value; minimum $120', true),
  ('muskoka', 'permit_formula', 'Town of Huntsville building permit', '12.50', 'per_thousand_value', 'permit', '$12.50 per $1,000 of construction value; minimum $150', true),
  ('muskoka', 'travel_rule', 'Travel time - Huntsville base', '0.65', 'per_km', 'travel', 'CRA mileage rate for travel to/from Huntsville as base (2024)', true),
  ('muskoka', 'travel_rule', 'Crew accommodation - remote stays', '195.00', 'flat_per_day', 'travel', 'Per diem for overnight stays on remote Muskoka projects', true)
ON CONFLICT DO NOTHING;
