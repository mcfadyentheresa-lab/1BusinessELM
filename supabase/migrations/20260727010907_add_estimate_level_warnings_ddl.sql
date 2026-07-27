/*
# Add estimate-level audit warnings (DDL)

## What this does
1. Makes estimate_item_id nullable (was NOT NULL)
2. Adds estimate_id integer column with FK to project_estimates(id)
3. Adds CHECK constraint: at least one of estimate_item_id / estimate_id must be non-null
4. Adds index on estimate_id
5. Recreates RLS policies (identical admin-only logic, needed for idempotency)
*/

-- 1. Make estimate_item_id nullable
ALTER TABLE estimate_warnings ALTER COLUMN estimate_item_id DROP NOT NULL;

-- 2. Add estimate_id column
ALTER TABLE estimate_warnings ADD COLUMN IF NOT EXISTS estimate_id integer;

-- 3. Add FK from estimate_id to project_estimates(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'estimate_warnings_estimate_id_fkey'
      AND table_name = 'estimate_warnings'
  ) THEN
    ALTER TABLE estimate_warnings
      ADD CONSTRAINT estimate_warnings_estimate_id_fkey
      FOREIGN KEY (estimate_id) REFERENCES project_estimates(id);
  END IF;
END $$;

-- 4. CHECK constraint: at least one target must be non-null
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'estimate_warnings_target_not_null'
      AND table_name = 'estimate_warnings'
  ) THEN
    ALTER TABLE estimate_warnings
      ADD CONSTRAINT estimate_warnings_target_not_null
      CHECK (estimate_item_id IS NOT NULL OR estimate_id IS NOT NULL);
  END IF;
END $$;

-- 5. Index on estimate_id
CREATE INDEX IF NOT EXISTS idx_estimate_warnings_estimate_id
  ON estimate_warnings (estimate_id);

-- 6. Recreate RLS policies (identical admin-only logic)
-- SELECT
DROP POLICY IF EXISTS "Admins can view estimate warnings" ON estimate_warnings;
CREATE POLICY "Admins can view estimate warnings"
  ON estimate_warnings FOR SELECT
  TO authenticated
  USING (get_my_role() = 'admin');

-- INSERT
DROP POLICY IF EXISTS "Admins can manage estimate warnings" ON estimate_warnings;
CREATE POLICY "Admins can manage estimate warnings"
  ON estimate_warnings FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

-- UPDATE
DROP POLICY IF EXISTS "Admins can update estimate warnings" ON estimate_warnings;
CREATE POLICY "Admins can update estimate warnings"
  ON estimate_warnings FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');