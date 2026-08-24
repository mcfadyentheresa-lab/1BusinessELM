/*
  # Validate markup/contingency/management fee percentages in save_estimate

  ## Problem
  Full estimate-area audit requested by the app's owner found that item 10's
  input validation (ESTIMATE_AUDIT.md §7c) only ever covered per-item
  quantity/unit_cost/material_cost - the three top-level percentage fields
  (contingency_percent, markup_percent, management_fee_percent) had zero
  validation anywhere: no client-side sanitization (unlike the line-item
  fields, which use sanitizeNumericInput), and no check in save_estimate.

  This isn't just a display glitch. get_client_estimate_summary casts these
  three fields directly to numeric to compute the client-facing total
  (`COALESCE(NULLIF(v_estimate.contingency_percent, ''), '0')::numeric`) -
  if garbage text had been saved into any of them, that cast throws a hard
  Postgres error ("invalid input syntax for type numeric"), which would
  break the client's estimate view entirely, not just show a wrong number.
  On the admin side, estimate-math.ts's computeEstimateTotals used a raw
  parseFloat() on these same fields with no NaN guard - reproducing the
  exact §7d/item 11 total-goes-to-$0.00 bug for a different set of fields
  after that bug was supposedly closed.

  ## Solution
  Extend save_estimate's existing item-level validation to also cover the
  three percentage fields, using the identical pattern already used for
  quantity/unit_cost/material_cost - reject the whole save with a clear
  error if any of them isn't empty-or-a-valid-non-negative-number, inside
  the same atomic transaction as the rest of the save.

  Client-side (CostEstimator.tsx) and estimate-math.ts (computeEstimateTotals)
  fixed in the same pass - sanitizeNumericInput now wraps all three
  percentage inputs, and computeEstimateTotals uses the same NaN-safe
  parsing calcItemTotal already used for line items.
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

  IF COALESCE(p_contingency_percent, '') !~ '^$|^\d+(\.\d+)?$'
     OR COALESCE(p_markup_percent, '') !~ '^$|^\d+(\.\d+)?$'
     OR COALESCE(p_management_fee_percent, '') !~ '^$|^\d+(\.\d+)?$'
  THEN
    RAISE EXCEPTION 'Contingency, markup, and management fee percentages must be non-negative numbers';
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
