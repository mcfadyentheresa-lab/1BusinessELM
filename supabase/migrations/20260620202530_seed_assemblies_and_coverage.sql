
-- ============================================================
-- Update coverage/waste on key existing materials
-- ============================================================
UPDATE supplier_prices SET coverage_value = 32, coverage_unit = 'sq ft', waste_pct = 10
  WHERE product_code = '12STD';  -- 4x8 sheet = 32 sq ft

UPDATE supplier_prices SET coverage_value = 1, coverage_unit = 'linear ft', waste_pct = 10
  WHERE unit_type = 'per linear ft';

UPDATE supplier_prices SET waste_pct = 5
  WHERE product_name ILIKE '%screw%' OR product_name ILIKE '%nail%' OR product_name ILIKE '%fastener%';

-- ============================================================
-- Seed estimate assemblies
-- ============================================================
DO $$
DECLARE
  v_cat_lumber    int;
  v_cat_exterior  int;
  v_cat_framing   int;
  v_cat_drywall   int;
  v_cat_flooring  int;
  v_cat_roofing   int;
  v_cat_decking   int;
  v_cat_insul     int;

  a_ext_wall      int;
  a_subfloor      int;
  a_shingle_roof  int;
  a_pt_deck       int;
  a_drywall_wall  int;
  a_cedar_deck    int;

  -- Material references
  m_2x6_10        int;
  m_osb           int;
  m_drywall       int;
  m_pt_2x10_10    int;
  m_pt_2x10_12    int;
  m_cedar_2x10_12 int;
BEGIN
  -- Resolve or create needed categories
  SELECT id INTO v_cat_lumber   FROM cost_categories WHERE name = 'Lumber & Framing';
  SELECT id INTO v_cat_exterior FROM cost_categories WHERE name = 'Exterior & Decking';
  SELECT id INTO v_cat_drywall  FROM cost_categories WHERE name = 'Drywall';

  -- Create assembly-specific categories if not present
  INSERT INTO cost_categories (name)
  SELECT v FROM (VALUES ('Roofing'),('Flooring'),('Insulation')) t(v)
  WHERE NOT EXISTS (SELECT 1 FROM cost_categories WHERE name = t.v);

  SELECT id INTO v_cat_roofing  FROM cost_categories WHERE name = 'Roofing';
  SELECT id INTO v_cat_flooring FROM cost_categories WHERE name = 'Flooring';
  SELECT id INTO v_cat_insul    FROM cost_categories WHERE name = 'Insulation';

  -- Material ids
  SELECT id INTO m_2x6_10   FROM supplier_prices WHERE product_code = '2610S'   LIMIT 1;
  SELECT id INTO m_osb      FROM supplier_prices WHERE product_code = '12STD'   LIMIT 1;
  SELECT id INTO m_pt_2x10_10  FROM supplier_prices WHERE product_code = '21010BPT' LIMIT 1;
  SELECT id INTO m_pt_2x10_12  FROM supplier_prices WHERE product_code = '21012BPT' LIMIT 1;
  SELECT id INTO m_cedar_2x10_12 FROM supplier_prices WHERE product_code = '21012C' LIMIT 1;

  -- ---- Assembly 1: 2x6 Exterior Wall Assembly (per sq ft of wall) ----
  INSERT INTO estimate_assemblies (name, description, category_id, quality_tier, notes)
  VALUES (
    '2x6 Exterior Wall Assembly',
    'Standard 2x6 @ 16" o.c. exterior wall framing. Material cost per sq ft of wall face.',
    v_cat_lumber, 'mid',
    'Includes studs, top/bottom plates. Add sheathing separately. Labour not included.'
  ) RETURNING id INTO a_ext_wall;

  INSERT INTO assembly_materials (assembly_id, material_id, material_name, unit_type, qty_per_sqft, unit_cost, waste_pct, sort_order) VALUES
    (a_ext_wall, m_2x6_10, '2 X 6 - 10 FT. SPRUCE', 'each', 0.083, 9.65, 10, 1),   -- ~1 stud per 12 sq ft wall face
    (a_ext_wall, NULL, 'Top & Bottom Plate (2x6 LF)', 'per linear ft', 0.167, 1.99, 8, 2);  -- 2 plates per LF of wall

  -- ---- Assembly 2: Plywood Subfloor Assembly ----
  INSERT INTO estimate_assemblies (name, description, category_id, quality_tier, notes)
  VALUES (
    'Plywood Subfloor Assembly',
    '1/2" standard sheathing subfloor. Material cost per sq ft of floor area.',
    v_cat_lumber, 'mid',
    'Based on 4x8 sheets (32 sq ft each). 10% waste factor included.'
  ) RETURNING id INTO a_subfloor;

  INSERT INTO assembly_materials (assembly_id, material_id, material_name, unit_type, qty_per_sqft, unit_cost, waste_pct, sort_order) VALUES
    (a_subfloor, m_osb, 'SHT. 1/2" STD SHEETING 4x8', 'each', 0.03125, 42.00, 10, 1),  -- 1/32 sheet per sq ft
    (a_subfloor, NULL, 'Subfloor Screws (allowance)', 'each', 0.05, 0.02, 5, 2);

  -- ---- Assembly 3: Pressure-Treated Deck Frame ----
  INSERT INTO estimate_assemblies (name, description, category_id, quality_tier, notes)
  VALUES (
    'Pressure-Treated Deck Frame',
    'PT 2x10 deck framing @ 16" o.c. Material cost per sq ft of deck area.',
    v_cat_exterior, 'mid',
    'Includes joists and double rim beam. Ledger and post hardware not included.'
  ) RETURNING id INTO a_pt_deck;

  INSERT INTO assembly_materials (assembly_id, material_id, material_name, unit_type, qty_per_sqft, unit_cost, waste_pct, sort_order) VALUES
    (a_pt_deck, m_pt_2x10_10, '2 X 10 - 10 BROWN PT', 'each', 0.075, 31.90, 10, 1),
    (a_pt_deck, m_pt_2x10_12, '2 X 10 - 12 BROWN PT (rim)', 'each', 0.025, 38.28, 10, 2);

  -- ---- Assembly 4: Cedar Deck Surface (2x10 Cedar) ----
  INSERT INTO estimate_assemblies (name, description, category_id, quality_tier, notes)
  VALUES (
    'Cedar Deck Surface Assembly',
    '2x10 cedar deck-grade boards laid perpendicular. Material cost per sq ft of deck surface.',
    v_cat_exterior, 'premium',
    'Assumes 2x10 cedar at 16" spacing face. Includes 10% waste for cuts.'
  ) RETURNING id INTO a_cedar_deck;

  INSERT INTO assembly_materials (assembly_id, material_id, material_name, unit_type, qty_per_sqft, unit_cost, waste_pct, sort_order) VALUES
    (a_cedar_deck, m_cedar_2x10_12, '2 X 10 - 12 FT CEDAR DECK GRADE', 'each', 0.0833, 131.40, 10, 1);

  -- ---- Assembly 5: Drywall Wall Finish ----
  INSERT INTO estimate_assemblies (name, description, category_id, quality_tier, notes)
  VALUES (
    'Drywall Wall Finish Assembly',
    '1/2" drywall on walls, taped and mudded. Material cost per sq ft of wall.',
    v_cat_drywall, 'mid',
    'Includes 4x8 drywall sheets and fasteners allowance. Compound/tape not included.'
  ) RETURNING id INTO a_drywall_wall;

  INSERT INTO assembly_materials (assembly_id, material_id, material_name, unit_type, qty_per_sqft, unit_cost, waste_pct, sort_order) VALUES
    (a_drywall_wall, NULL, '1/2" Drywall 4x8 sheet', 'each', 0.03125, 16.50, 12, 1),  -- market price placeholder
    (a_drywall_wall, NULL, 'Drywall Screws (1-5/8") box', 'each', 0.002, 12.00, 5, 2);

END $$;
