/*
# Add audit run timestamps to project_estimates

## Purpose
The Confidence score card on the Cost Estimator page infers whether an estimate
has been audited / client-reviewed from the presence of warning rows. When an
audit or client review finds zero issues, no warning rows are written, so the
card incorrectly shows "never run" instead of a real score. These two new
timestamp columns record when each check actually ran, giving the frontend a
reliable signal regardless of whether any warnings were produced.

## Changes
1. New columns on `project_estimates`:
   - `last_audited_at` (timestamptz, nullable) — set by the estimate-auditor
     edge function at the end of every successful run, regardless of whether
     any warnings were found.
   - `last_client_reviewed_at` (timestamptz, nullable) — set by the
     estimate-client-reviewer edge function at the end of every successful run.
   Both default to NULL (never run). No backfill is needed — existing estimates
   simply read as "not yet audited/reviewed", which is accurate.

## Security
- No RLS changes. The edge functions update these columns using the service
  role key (bypasses RLS). The frontend already selects `project_estimates`
  via existing SELECT policies, which are unchanged.
- No new tables, no new policies.

## Notes
1. Additive only — no data loss, no type changes, no renames.
2. The estimate query in CostEstimator.tsx uses `select("*, items:estimate_items(*)")`,
   so the new columns arrive automatically with no query changes.
3. Idempotent: re-running this migration is a no-op.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'project_estimates' AND column_name = 'last_audited_at'
  ) THEN
    ALTER TABLE project_estimates ADD COLUMN last_audited_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'project_estimates' AND column_name = 'last_client_reviewed_at'
  ) THEN
    ALTER TABLE project_estimates ADD COLUMN last_client_reviewed_at timestamptz;
  END IF;
END $$;