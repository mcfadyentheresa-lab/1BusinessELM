/*
# Add `source` column to estimate_warnings

1. Purpose
   - Adds a `source` column to distinguish warnings produced by the cost Auditor
     (pricing accuracy) from warnings produced by the new Client-Side Reviewer
     (clarity from a client's perspective). Both share the same table.
   - Existing rows are backfilled to 'audit' via the column DEFAULT.
   - A CHECK constraint limits values to 'audit' or 'client_review'.

2. Changes
   - ALTER TABLE estimate_warnings ADD COLUMN source text NOT NULL DEFAULT 'audit'
   - CHECK constraint: source IN ('audit', 'client_review')
   - Index on (estimate_id, source) to support filtered queries in CostEstimator.tsx
     (e.g. "show only audit warnings" or "show only client_review warnings")

3. Data Safety
   - No columns dropped, renamed, or type-changed.
   - All existing rows automatically receive source='audit' from the DEFAULT.
   - No data loss.
*/
ALTER TABLE estimate_warnings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'audit';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estimate_warnings_source_check'
  ) THEN
    ALTER TABLE estimate_warnings
      ADD CONSTRAINT estimate_warnings_source_check
      CHECK (source IN ('audit', 'client_review'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_estimate_warnings_estimate_id_source
  ON estimate_warnings (estimate_id, source);
