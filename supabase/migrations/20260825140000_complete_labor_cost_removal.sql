/*
  # Complete the labor_cost removal started by 20260821140000

  ## Problem
  20260821140000_drop_dead_labor_cost_column.sql was only partially applied
  out-of-band before this migration history was fully synced: the
  ALTER TABLE ... DROP COLUMN labor_cost ran, but the accompanying
  CREATE OR REPLACE FUNCTION save_estimate(...) and
  DROP FUNCTION safe_numeric(text) never did. As a result, save_estimate()
  was left referencing both a column that no longer exists and a helper
  function retained only for that column — every call to save_estimate()
  was failing on production with "column labor_cost does not exist".

  Confirmed live via `supabase db query --linked` before writing this file:
  labor_cost was already gone from estimate_items, but pg_get_functiondef
  on save_estimate still showed the old body (labor_cost insert +
  safe_numeric() call), and safe_numeric() still existed.

  ## Solution
  Re-apply exactly the two statements 20260821140000 never got to run.
  Identical to that migration's intent — just split out so it can be
  pushed on its own via the normal migration path instead of a raw ad hoc
  query, since 20260821140000 itself can no longer run cleanly (its first
  statement targets a column that's already gone).
*/

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
