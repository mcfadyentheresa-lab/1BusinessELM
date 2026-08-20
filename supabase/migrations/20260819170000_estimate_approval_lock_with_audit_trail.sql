/*
  # Real estimate approval/lock with audit trail

  ## Problem
  ESTIMATE_AUDIT.md found that "locked estimates" was marketed on the
  landing page but did not actually exist: nothing in the app ever
  transitioned project_estimates.status away from 'draft', and even the
  frontend's own isLocked check had no server-side backing at all - every
  write policy on project_estimates/estimate_items was purely
  get_my_role() = 'admin', with no reference to status anywhere. An admin
  session could silently edit or rename an "approved" estimate with no
  record it happened, which defeats the entire point of an audit trail.

  ## Design decision (discussed with the app's owner)
  Approving an estimate locks it. An admin CAN unlock a locked estimate
  to make corrections (rather than forcing a new estimate for every
  change) - but unlocking without any record would itself be a way to
  silently rewrite what a client was shown as approved. So:
    - Every approval snapshots the full estimate + line items as they
      stood at that moment, into an append-only history table.
    - Every unlock requires a reason and is logged the same way.
    - This preserves "can always prove what was approved and when" even
      though unlock-and-reapprove is allowed, matching the existing
      ignored_by/ignored_at pattern already used for warnings.

  ## What this migration does
  1. Adds a CHECK constraint restricting project_estimates.status to
     ('draft', 'approved') - previously unconstrained free text.
  2. Creates estimate_status_history: append-only (no UPDATE/DELETE
     policy at all, same intentional pattern already used for
     material_price_history), admin-only SELECT/INSERT.
  3. Creates approve_estimate(p_estimate_id) and
     unlock_estimate(p_estimate_id, p_reason): SECURITY DEFINER so they
     can perform their own narrow, specific writes even once the RLS
     tightening below blocks direct writes to an approved estimate; each
     does its own explicit get_my_role() = 'admin' check as the actual
     authorization gate (RLS still independently enforces this on the
     underlying tables as defense in depth). EXECUTE is granted to
     authenticated only, not PUBLIC.
  4. Tightens project_estimates UPDATE and estimate_items
     INSERT/UPDATE/DELETE policies to also require the estimate's
     status = 'draft' - so a direct client-side write (e.g. the existing
     Save/rename code paths, unchanged by this migration) is now
     genuinely rejected by RLS once an estimate is approved, not just
     disabled in the UI. INSERT on project_estimates (creating a new
     estimate) and SELECT everywhere are unaffected - locking only ever
     applies to editing an existing estimate.

  Verified live before applying: all existing project_estimates rows are
  already 'draft' (confirmed via direct query), so the new CHECK
  constraint is safe to add with no data migration needed.
*/

-- 1. Constrain status to the two real states.
ALTER TABLE project_estimates
  ADD CONSTRAINT project_estimates_status_check CHECK (status IN ('draft', 'approved'));

-- 2. Append-only approval/unlock history.
CREATE TABLE IF NOT EXISTS estimate_status_history (
  id serial PRIMARY KEY,
  estimate_id integer NOT NULL REFERENCES project_estimates(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approved', 'unlocked')),
  snapshot jsonb,
  reason text,
  performed_by uuid REFERENCES profiles(id),
  performed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE estimate_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view estimate status history"
  ON estimate_status_history FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY "Admins can insert estimate status history"
  ON estimate_status_history FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

-- No UPDATE or DELETE policy at all, intentionally - this table is the
-- audit trail itself and must not be editable, even by an admin.

-- 3. The only two ways status may change, each logging what it did.
CREATE OR REPLACE FUNCTION public.approve_estimate(p_estimate_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve estimates';
  END IF;

  SELECT jsonb_build_object(
    'estimate', to_jsonb(pe),
    'items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(ei)) FROM public.estimate_items ei WHERE ei.estimate_id = pe.id),
      '[]'::jsonb
    )
  )
  INTO v_snapshot
  FROM public.project_estimates pe
  WHERE pe.id = p_estimate_id;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  UPDATE public.project_estimates
  SET status = 'approved', approved_at = now(), approved_by = auth.uid()
  WHERE id = p_estimate_id;

  INSERT INTO public.estimate_status_history (estimate_id, action, snapshot, performed_by)
  VALUES (p_estimate_id, 'approved', v_snapshot, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.unlock_estimate(p_estimate_id integer, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can unlock estimates';
  END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required to unlock an estimate';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_estimates WHERE id = p_estimate_id) THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  UPDATE public.project_estimates
  SET status = 'draft'
  WHERE id = p_estimate_id;

  INSERT INTO public.estimate_status_history (estimate_id, action, reason, performed_by)
  VALUES (p_estimate_id, 'unlocked', trim(p_reason), auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_estimate(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unlock_estimate(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_estimate(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_estimate(integer, text) TO authenticated;

-- 4. Make the lock real: direct writes to an approved estimate are now
-- actually rejected by RLS, not just disabled in the UI. The two
-- SECURITY DEFINER functions above are unaffected by this, since they
-- run with definer privileges rather than the calling user's.
DROP POLICY IF EXISTS "Admins can update estimates" ON project_estimates;
CREATE POLICY "Admins can update draft estimates"
  ON project_estimates FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin' AND status = 'draft')
  WITH CHECK (public.get_my_role() = 'admin' AND status = 'draft');

DROP POLICY IF EXISTS "Admins can manage estimate items" ON estimate_items;
CREATE POLICY "Admins can manage draft estimate items"
  ON estimate_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'admin'
    AND EXISTS (SELECT 1 FROM public.project_estimates pe WHERE pe.id = estimate_items.estimate_id AND pe.status = 'draft')
  );

DROP POLICY IF EXISTS "Admins can update estimate items" ON estimate_items;
CREATE POLICY "Admins can update draft estimate items"
  ON estimate_items FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'admin'
    AND EXISTS (SELECT 1 FROM public.project_estimates pe WHERE pe.id = estimate_items.estimate_id AND pe.status = 'draft')
  )
  WITH CHECK (
    public.get_my_role() = 'admin'
    AND EXISTS (SELECT 1 FROM public.project_estimates pe WHERE pe.id = estimate_items.estimate_id AND pe.status = 'draft')
  );

DROP POLICY IF EXISTS "Admins can delete estimate items" ON estimate_items;
CREATE POLICY "Admins can delete draft estimate items"
  ON estimate_items FOR DELETE
  TO authenticated
  USING (
    public.get_my_role() = 'admin'
    AND EXISTS (SELECT 1 FROM public.project_estimates pe WHERE pe.id = estimate_items.estimate_id AND pe.status = 'draft')
  );
