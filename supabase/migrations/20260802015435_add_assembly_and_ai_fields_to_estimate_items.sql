/*
# Add assembly_id, material_from_assembly, ai_suggested to estimate_items

## Purpose
The Cost Estimator UI sets assembly_id, material_from_assembly, and ai_suggested
on line items in local React state when a user picks an assembly or generates a
draft. However, the estimate_items table had no columns for these fields, so
they were silently dropped on every save. After reload, items filled "from
assembly" were indistinguishable from items with manually typed material costs.
This migration adds the three missing columns so they can be persisted.

## Changes to estimate_items
1. assembly_id (integer, nullable) — FK to estimate_assemblies.id
   with ON DELETE NO ACTION, matching the existing pattern for market_rate_id,
   crew_rate_id, and subcontractor_id (all NO ACTION; only estimate_id uses CASCADE).
2. material_from_assembly (boolean, nullable, default false) — marks whether
   the material_cost was derived from an assembly rather than typed manually.
3. ai_suggested (boolean, nullable, default false) — marks whether the line
   item originated from the AI draft generator.

## Security
No RLS changes — estimate_items already has RLS enabled and policies in place.
No new tables created.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estimate_items' AND column_name = 'assembly_id'
  ) THEN
    ALTER TABLE estimate_items ADD COLUMN assembly_id integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estimate_items' AND column_name = 'material_from_assembly'
  ) THEN
    ALTER TABLE estimate_items ADD COLUMN material_from_assembly boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'estimate_items' AND column_name = 'ai_suggested'
  ) THEN
    ALTER TABLE estimate_items ADD COLUMN ai_suggested boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'estimate_items_assembly_id_fkey'
  ) THEN
    ALTER TABLE estimate_items
      ADD CONSTRAINT estimate_items_assembly_id_fkey
      FOREIGN KEY (assembly_id) REFERENCES estimate_assemblies(id) ON DELETE NO ACTION;
  END IF;
END $$;
