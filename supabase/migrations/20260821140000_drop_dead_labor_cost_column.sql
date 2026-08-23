/*
  # Drop the dead estimate_items.labor_cost column

  ## Problem
  ESTIMATE_AUDIT.md §7e: labor_cost has been a write-only column since the
  cost estimator was first built - save_estimate computes and stores
  unit_cost * quantity into it on every save, but grepping every reference
  in src/ and supabase/functions/ turns up nothing that ever reads it back.
  All real totals are recomputed live from unit_cost/quantity/material_cost
  (see estimate-math.ts). It was also confusing dead weight: under the
  §7d/item 11 NaN bug it could silently store the literal string "NaN",
  and safe_numeric() (added in 20260820120000) existed purely to stop that
  from happening to a column nothing uses.

  ## Solution
  Remove it outright rather than wire it up - there's no reporting or UI
  need for a separate labor-only figure today, and keeping an unused column
  computed on every write is worse than not having it. save_estimate no
  longer computes or inserts it. safe_numeric() had no other caller, so it
  goes too rather than leaving a helper with zero remaining callers.
*/

ALTER TABLE estimate_items DROP COLUMN labor_cost;

CREATE OR REPLACE FUNCTION public.save_estimate(
  p_estimate_id integer,
  p_markup_enabled boolean,
  p_markup_percent text,
  p_contingency_percent text,
  p_management_fee_enabled boolean,
  p_management_fee_percent text,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can save estimates';
  END IF;

  SELECT status INTO v_status FROM public.project_estimates WHERE id = p_estimate_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Cannot save a locked estimate';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    WHERE COALESCE(item->>'quantity', '') !~ '^$|^\d+(\.\d+)?$'
       OR COALESCE(item->>'unit_cost', '') !~ '^$|^\d+(\.\d+)?$'
       OR COALESCE(item->>'material_cost', '') !~ '^$|^\d+(\.\d+)?$'
  ) THEN
    RAISE EXCEPTION 'One or more line items has an invalid quantity, unit cost, or material cost — only non-negative numbers are allowed';
  END IF;

  UPDATE public.project_estimates
  SET markup_enabled = p_markup_enabled,
      markup_percent = p_markup_percent,
      contingency_percent = p_contingency_percent,
      management_fee_enabled = p_management_fee_enabled,
      management_fee_percent = p_management_fee_percent
  WHERE id = p_estimate_id;

  DELETE FROM public.estimate_items WHERE estimate_id = p_estimate_id;

  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.estimate_items (
      estimate_id, category_id, custom_category, room, quantity, unit_type,
      unit_cost, material_cost, notes, assembly_id,
      material_from_assembly, ai_suggested
    )
    SELECT
      p_estimate_id,
      NULLIF(item->>'category_id', '')::integer,
      NULLIF(item->>'custom_category', ''),
      NULLIF(item->>'room', ''),
      COALESCE(item->>'quantity', '0'),
      COALESCE(item->>'unit_type', 'sq_ft'),
      COALESCE(item->>'unit_cost', '0'),
      COALESCE(item->>'material_cost', '0'),
      NULLIF(item->>'notes', ''),
      NULLIF(item->>'assembly_id', '')::integer,
      COALESCE((item->>'material_from_assembly')::boolean, false),
      COALESCE((item->>'ai_suggested')::boolean, false)
    FROM jsonb_array_elements(p_items) AS item;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.safe_numeric(text);
