/*
  # Client-facing estimate summary (ESTIMATE_AUDIT.md item 8)

  ## Problem
  Clients have zero visibility into their own project's estimate - not
  even after it's approved and sent. Raised by the app's owner while
  testing the approval flow, logged as item 8 and explicitly deferred
  pending a product decision on what a client should actually see.

  ## Decision (discussed with the app's owner, 2026-08-21)
  Clients should see their approved estimate, but only a summary: the
  rooms/areas covered and the final approved total - never the per-item
  breakdown or unit rates. This isn't just a UI choice: unit_cost/
  material_cost on each line are pre-markup costs, and markup/contingency/
  management fee are applied once to the whole subtotal, not per line - so
  showing a client a raw line-item price wouldn't even match what they're
  actually paying for that line, and would expose the underlying cost
  structure alongside it.

  ## Why a function instead of an RLS policy
  Postgres RLS is row-level, not column-level - a SELECT policy on
  estimate_items can't show a client `room`/`quantity` while hiding
  `unit_cost` on the same row. This mirrors a gap already present in
  projects.budget_visible_to_client, which is only enforced by the
  frontend hiding the field - a client hitting the REST API directly
  still gets the full row including total_budget regardless of the
  toggle. Not fixing that here, just not repeating the same shape of gap:
  this uses a SECURITY DEFINER function (same pattern as
  save_estimate/approve_estimate/unlock_estimate) that returns exactly the
  client-safe shape and nothing else, so there is no raw table access to
  fall back on.

  Only ever returns the most recently approved estimate for the project -
  a draft is a work in progress and was never meant to be client-visible,
  consistent with the reliability work done on this feature so far. The
  total is computed here with the exact same subtotal -> contingency ->
  markup -> management fee chain as computeEstimateTotals()
  (src/lib/estimate-math.ts), so it can never drift from what the number
  meant when it was approved.
*/

CREATE OR REPLACE FUNCTION public.get_client_estimate_summary(p_project_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estimate record;
  v_subtotal numeric;
  v_with_contingency numeric;
  v_markup numeric;
  v_with_markup numeric;
  v_management_fee numeric;
  v_total numeric;
  v_rooms jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id
      AND (client_id = auth.uid() OR public.get_my_role() = 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to view this project''s estimate';
  END IF;

  SELECT id, approved_at, contingency_percent, markup_enabled, markup_percent,
         management_fee_enabled, management_fee_percent
  INTO v_estimate
  FROM public.project_estimates
  WHERE project_id = p_project_id AND status = 'approved'
  ORDER BY approved_at DESC
  LIMIT 1;

  IF v_estimate.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(
    COALESCE(NULLIF(quantity, ''), '0')::numeric *
    (COALESCE(NULLIF(unit_cost, ''), '0')::numeric + COALESCE(NULLIF(material_cost, ''), '0')::numeric)
  ), 0)
  INTO v_subtotal
  FROM public.estimate_items
  WHERE estimate_id = v_estimate.id;

  v_with_contingency := v_subtotal + v_subtotal * (COALESCE(NULLIF(v_estimate.contingency_percent, ''), '0')::numeric / 100);
  v_markup := CASE WHEN v_estimate.markup_enabled
    THEN v_with_contingency * (COALESCE(NULLIF(v_estimate.markup_percent, ''), '0')::numeric / 100)
    ELSE 0 END;
  v_with_markup := v_with_contingency + v_markup;
  v_management_fee := CASE WHEN v_estimate.management_fee_enabled
    THEN v_with_markup * (COALESCE(NULLIF(v_estimate.management_fee_percent, ''), '0')::numeric / 100)
    ELSE 0 END;
  v_total := v_with_markup + v_management_fee;

  SELECT COALESCE(jsonb_agg(DISTINCT COALESCE(NULLIF(room, ''), 'General')), '[]'::jsonb)
  INTO v_rooms
  FROM public.estimate_items
  WHERE estimate_id = v_estimate.id;

  RETURN jsonb_build_object(
    'approved_at', v_estimate.approved_at,
    'total', v_total,
    'rooms', v_rooms
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_client_estimate_summary(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_estimate_summary(integer) TO authenticated;
