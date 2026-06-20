/*
  # Cost Estimator Tables

  1. New Tables
    - `cost_categories` — renovation work type categories
    - `market_rates` — baseline pricing per category
    - `project_estimates` — per-project estimate with markup/contingency controls
    - `estimate_items` — individual line items in an estimate
    - `estimate_warnings` — price variance alerts
    - `receipts` — actual expenses to compare against estimates
    - `crew_rates` — hourly pay/bill rates for crew members
    - `subcontractors` — subcontractor contacts and rates
    - `suppliers` — material supplier/vendor directory
    - `supplier_prices` — price book built from receipts
    - `regional_modifiers` — Muskoka-specific surcharges and rules

  2. Security
    - All tables admin-only except market_rates/cost_categories which crew can read
*/

-- Cost categories
CREATE TABLE IF NOT EXISTS cost_categories (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  default_unit_type text NOT NULL DEFAULT 'sq_ft',
  sort_order integer DEFAULT 0
);

ALTER TABLE cost_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view cost categories"
  ON cost_categories FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can manage cost categories"
  ON cost_categories FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update cost categories"
  ON cost_categories FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Market rates
CREATE TABLE IF NOT EXISTS market_rates (
  id serial PRIMARY KEY,
  category_id integer NOT NULL REFERENCES cost_categories(id) ON DELETE CASCADE,
  unit_type text NOT NULL DEFAULT 'sq_ft',
  low_rate text NOT NULL,
  high_rate text NOT NULL,
  typical_rate text NOT NULL,
  effective_date date NOT NULL,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE market_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view market rates"
  ON market_rates FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can manage market rates"
  ON market_rates FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update market rates"
  ON market_rates FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Crew rates
CREATE TABLE IF NOT EXISTS crew_rates (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  name text NOT NULL,
  role text,
  pay_rate text NOT NULL,
  billable_rate text NOT NULL,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crew_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view crew rates"
  ON crew_rates FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage crew rates"
  ON crew_rates FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update crew rates"
  ON crew_rates FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Subcontractors
CREATE TABLE IF NOT EXISTS subcontractors (
  id serial PRIMARY KEY,
  business_name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  category_id integer REFERENCES cost_categories(id),
  trade text,
  hourly_rate text,
  daily_rate text,
  unit_rate text,
  unit_type text,
  is_preferred boolean DEFAULT false,
  is_active boolean DEFAULT true,
  address text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view subcontractors"
  ON subcontractors FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can manage subcontractors"
  ON subcontractors FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update subcontractors"
  ON subcontractors FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  website text,
  is_preferred boolean DEFAULT false,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can manage suppliers"
  ON suppliers FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Project estimates
CREATE TABLE IF NOT EXISTS project_estimates (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Main Estimate',
  status text NOT NULL DEFAULT 'draft',
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  sent_at timestamptz,
  revised_from_id integer,
  markup_enabled boolean DEFAULT true,
  markup_percent text NOT NULL DEFAULT '25',
  budget text,
  contingency_percent text DEFAULT '0',
  management_fee_enabled boolean DEFAULT false,
  management_fee_percent text NOT NULL DEFAULT '25',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all estimates"
  ON project_estimates FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage estimates"
  ON project_estimates FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update estimates"
  ON project_estimates FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Estimate items
CREATE TABLE IF NOT EXISTS estimate_items (
  id serial PRIMARY KEY,
  estimate_id integer NOT NULL REFERENCES project_estimates(id) ON DELETE CASCADE,
  category_id integer REFERENCES cost_categories(id),
  custom_category text,
  room text,
  product_url text,
  unit_type text NOT NULL DEFAULT 'sq_ft',
  quantity text NOT NULL,
  unit_cost text NOT NULL,
  material_cost text NOT NULL DEFAULT '0',
  labor_cost text NOT NULL DEFAULT '0',
  is_custom_rate boolean DEFAULT false,
  market_rate_id integer REFERENCES market_rates(id),
  notes text,
  crew_rate_id integer REFERENCES crew_rates(id),
  subcontractor_id integer REFERENCES subcontractors(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view estimate items"
  ON estimate_items FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage estimate items"
  ON estimate_items FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update estimate items"
  ON estimate_items FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete estimate items"
  ON estimate_items FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Estimate warnings
CREATE TABLE IF NOT EXISTS estimate_warnings (
  id serial PRIMARY KEY,
  estimate_item_id integer NOT NULL REFERENCES estimate_items(id) ON DELETE CASCADE,
  warning_type text NOT NULL,
  message text NOT NULL,
  percent_diff text,
  ignored boolean DEFAULT false,
  ignored_by uuid REFERENCES profiles(id),
  ignored_at timestamptz
);

ALTER TABLE estimate_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view estimate warnings"
  ON estimate_warnings FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage estimate warnings"
  ON estimate_warnings FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update estimate warnings"
  ON estimate_warnings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
  id serial PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  estimate_item_id integer REFERENCES estimate_items(id),
  vendor text NOT NULL,
  description text,
  date date NOT NULL,
  amount text NOT NULL,
  file_url text,
  line_items jsonb,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view receipts"
  ON receipts FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage receipts"
  ON receipts FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update receipts"
  ON receipts FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Supplier prices
CREATE TABLE IF NOT EXISTS supplier_prices (
  id serial PRIMARY KEY,
  supplier_id integer NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  category_id integer REFERENCES cost_categories(id),
  unit_price text NOT NULL,
  unit_type text NOT NULL DEFAULT 'unit',
  product_code text,
  product_url text,
  source_receipt_id integer REFERENCES receipts(id),
  notes text,
  last_updated timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE supplier_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view supplier prices"
  ON supplier_prices FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can manage supplier prices"
  ON supplier_prices FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update supplier prices"
  ON supplier_prices FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Regional modifiers
CREATE TABLE IF NOT EXISTS regional_modifiers (
  id serial PRIMARY KEY,
  region text NOT NULL DEFAULT 'muskoka',
  modifier_type text NOT NULL,
  name text NOT NULL,
  value text,
  unit text,
  applies_to text,
  description text,
  source_url text,
  last_verified date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE regional_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and crew can view regional modifiers"
  ON regional_modifiers FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'crew')));

CREATE POLICY "Admins can manage regional modifiers"
  ON regional_modifiers FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update regional modifiers"
  ON regional_modifiers FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
