
-- ============================================================
-- Enhance supplier_prices with coverage/waste fields
-- ============================================================
ALTER TABLE supplier_prices
  ADD COLUMN IF NOT EXISTS coverage_value   numeric(10,4),  -- e.g. 32 sq ft per sheet
  ADD COLUMN IF NOT EXISTS coverage_unit    text,           -- e.g. 'sq ft'
  ADD COLUMN IF NOT EXISTS waste_pct        numeric(5,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS quality_tier     text DEFAULT 'mid' CHECK (quality_tier IN ('basic','mid','premium'));

-- ============================================================
-- Material price history (phase 2 audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS material_price_history (
  id            serial PRIMARY KEY,
  material_id   integer NOT NULL REFERENCES supplier_prices(id) ON DELETE CASCADE,
  unit_price    text NOT NULL,
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  notes         text
);

ALTER TABLE material_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view material price history"  ON material_price_history FOR SELECT TO authenticated USING (get_my_role() = 'admin');
CREATE POLICY "Admins can insert material price history" ON material_price_history FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'admin');

-- ============================================================
-- Estimate assemblies
-- ============================================================
CREATE TABLE IF NOT EXISTS estimate_assemblies (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  description   text,
  category_id   integer REFERENCES cost_categories(id),
  quality_tier  text DEFAULT 'mid' CHECK (quality_tier IN ('basic','mid','premium')),
  notes         text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE estimate_assemblies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and crew can view assemblies"  ON estimate_assemblies FOR SELECT TO authenticated USING (get_my_role() = ANY(ARRAY['admin','crew']));
CREATE POLICY "Admins can insert assemblies"         ON estimate_assemblies FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Admins can update assemblies"         ON estimate_assemblies FOR UPDATE TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Admins can delete assemblies"         ON estimate_assemblies FOR DELETE TO authenticated USING (get_my_role() = 'admin');

-- ============================================================
-- Assembly line items
-- ============================================================
CREATE TABLE IF NOT EXISTS assembly_materials (
  id              serial PRIMARY KEY,
  assembly_id     integer NOT NULL REFERENCES estimate_assemblies(id) ON DELETE CASCADE,
  material_id     integer REFERENCES supplier_prices(id) ON DELETE SET NULL,
  material_name   text NOT NULL,        -- denormalised name so assembly is self-describing
  unit_type       text NOT NULL,
  qty_per_sqft    numeric(10,6) NOT NULL DEFAULT 1,
  unit_cost       numeric(10,4) NOT NULL DEFAULT 0,
  waste_pct       numeric(5,2) NOT NULL DEFAULT 10,
  notes           text,
  sort_order      integer NOT NULL DEFAULT 0
);

ALTER TABLE assembly_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and crew can view assembly materials"  ON assembly_materials FOR SELECT TO authenticated USING (get_my_role() = ANY(ARRAY['admin','crew']));
CREATE POLICY "Admins can insert assembly materials"         ON assembly_materials FOR INSERT TO authenticated WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Admins can update assembly materials"         ON assembly_materials FOR UPDATE TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "Admins can delete assembly materials"         ON assembly_materials FOR DELETE TO authenticated USING (get_my_role() = 'admin');
