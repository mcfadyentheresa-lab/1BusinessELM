/*
  # Atomic, error-checked estimate save

  ## Problem
  ESTIMATE_AUDIT.md finding 7a/7b: CostEstimator.tsx's handleSave did three
  separate writes - update project_estimates settings, delete all
  estimate_items for the estimate, then insert the new set - as three
  independent Supabase client calls, none of which checked their error.
  If the insert failed for any reason after the delete had already
  succeeded, the code did not throw: it proceeded straight to "Estimate
  saved" while the database was left with zero line items for that
  estimate. Even with error-checking added client-side, delete-then-insert
  as two separate network round-trips is not atomic - a dropped
  connection or closed tab between them leaves the same empty-estimate
  state, just from an interruption rather than a swallowed error.

  ## Solution
  A single SECURITY DEFINER function that does the settings update, the
  delete, and the insert inside one Postgres transaction (the function
  body itself), so any failure anywhere rolls back the whole save and a
  real error reaches the caller - matching the same pattern already used
  for approve_estimate/unlock_estimate.

  Explicitly re-checks status = 'draft' inside the function: since this
  runs with definer privileges, it would otherwise bypass the RLS lock
  enforcement added for approved estimates (20260819170000), which is
  exactly the vulnerability that migration closed.

  ## Scope note
  This fixes atomicity and error-handling only (fix list item 9). It does
  not add input validation on quantity/unit_cost/material_cost (item 10)
  or guard against a non-numeric value corrupting the displayed total
  (item 11) - those are separate, not-yet-addressed items. labor_cost is
  computed the same way as before (unit_cost * quantity) using a safe
  cast that falls back to 0 for non-numeric input, preserving today's
  forgiving behavior rather than turning one bad field into a hard error
  that blocks the whole save with no explanation - that tradeoff belongs
  to items 10/11, not this fix.
*/

CREATE OR REPLACE FUNCTION public.safe_numeric(p_value text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_value ~ '^-?\d+(\.\d+)?$' THEN p_value::numeric
    ELSE 0
  END;
$$;

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

REVOKE EXECUTE ON FUNCTION public.save_estimate(integer, boolean, text, text, boolean, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_estimate(integer, boolean, text, text, boolean, text, jsonb) TO authenticated;

-- safe_numeric is a small pure helper with no privilege implications of
-- its own; still scope it to authenticated only for consistency.
REVOKE EXECUTE ON FUNCTION public.safe_numeric(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_numeric(text) TO authenticated;
