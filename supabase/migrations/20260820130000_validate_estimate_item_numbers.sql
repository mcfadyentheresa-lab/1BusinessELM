/*
  # Reject invalid quantity/unit cost/material cost in save_estimate

  ## Problem
  ESTIMATE_AUDIT.md finding 7c/7d: quantity, unit_cost, and material_cost
  had no validation anywhere - plain text inputs client-side, and
  save_estimate (added 20260820120000) accepted anything, silently
  treating non-numeric values as 0 via safe_numeric() when computing
  labor_cost. That made save_estimate itself safe from the NaN bug, but
  never actually stopped bad data (garbage text, negative numbers) from
  being typed in or saved to quantity/unit_cost/material_cost themselves
  - only labor_cost was guarded.

  ## Solution
  save_estimate now rejects the entire save with a clear error if any
  line item's quantity, unit_cost, or material_cost is non-empty and not
  a valid non-negative decimal. Empty string remains allowed (an item can
  have a category set with no quantity yet, e.g. a placeholder saved as
  draft) - only garbage and negative values are rejected, matching the
  fix list's own framing exactly. Client-side, CostEstimator.tsx now
  sanitizes these three inputs on every change so invalid characters
  can't be typed or pasted in the first place - this is the server-side
  half of the same fix, closing the gap for a direct API call that
  bypasses the client entirely.

  Validation runs before any write, inside the same transaction as
  20260820120000's atomicity fix - so an invalid item rejects the whole
  save with nothing touched, consistent with that fix's guarantee.
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
      unit_cost, material_cost, labor_cost, notes, assembly_id,
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
      (public.safe_numeric(item->>'unit_cost') * public.safe_numeric(item->>'quantity'))::text,
      NULLIF(item->>'notes', ''),
      NULLIF(item->>'assembly_id', '')::integer,
      COALESCE((item->>'material_from_assembly')::boolean, false),
      COALESCE((item->>'ai_suggested')::boolean, false)
    FROM jsonb_array_elements(p_items) AS item;
  END IF;
END;
$$;
