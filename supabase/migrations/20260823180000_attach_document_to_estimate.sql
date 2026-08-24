/*
  # Let an admin attach a document to an estimate, surfaced on the client card

  ## Problem
  ESTIMATE_AUDIT.md item 8's client-facing summary card (total + approval
  date + rooms, deliberately no per-item breakdown) was raised again: should
  it link to something more concrete? Discussed with the app's owner -
  QuickBooks integration is a real but separate, much larger question
  (see QUICKBOOKS_INTEGRATION.md). The smaller, real win available now:
  let admin attach a document (e.g. a formal PDF proposal) to an approved
  estimate, and surface a link to it right on the client's card.

  ## Design
  Reuses the existing `documents` table and `project-assets` storage bucket
  rather than building new plumbing - that table already has working RLS
  ("Clients can view own project documents"), the bucket is already public
  and already allows `application/pdf`, and admin already has an upload
  flow for it in ProjectDetails.tsx. The only new piece is a link from a
  specific estimate to one specific document.

  `attach_estimate_document` is SECURITY DEFINER (like save_estimate/
  approve_estimate) because project_estimates' UPDATE policy requires
  status = 'draft' - attaching a document is normally something you do
  *after* approving/locking an estimate, so a plain client-side update
  would be rejected by the very lock this engagement built. This function
  is intentionally narrow: it only ever touches document_id, nothing else
  a locked estimate protects.

  get_client_estimate_summary now also returns document_url/document_title
  when one is attached - looked up inside the function itself (SECURITY
  DEFINER, bypasses RLS for this one internal read), so the client never
  needs direct table access to `documents` for this to work.
*/

ALTER TABLE project_estimates ADD COLUMN document_id integer REFERENCES documents(id);

CREATE OR REPLACE FUNCTION public.attach_estimate_document(
  p_estimate_id integer,
  p_title text,
  p_url text,
  p_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id integer;
  v_document_id integer;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can attach an estimate document';
  END IF;

  SELECT project_id INTO v_project_id FROM public.project_estimates WHERE id = p_estimate_id;
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  INSERT INTO public.documents (project_id, title, url, type)
  VALUES (v_project_id, p_title, p_url, p_type)
  RETURNING id INTO v_document_id;

  UPDATE public.project_estimates SET document_id = v_document_id WHERE id = p_estimate_id;

  RETURN v_document_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.attach_estimate_document(integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_estimate_document(integer, text, text, text) TO authenticated;

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
  v_document_title text;
  v_document_url text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id
      AND (client_id = auth.uid() OR public.get_my_role() = 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to view this project''s estimate';
  END IF;

  SELECT id, approved_at, contingency_percent, markup_enabled, markup_percent,
         management_fee_enabled, management_fee_percent, document_id
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

  IF v_estimate.document_id IS NOT NULL THEN
    SELECT title, url INTO v_document_title, v_document_url
    FROM public.documents WHERE id = v_estimate.document_id;
  END IF;

  RETURN jsonb_build_object(
    'approved_at', v_estimate.approved_at,
    'total', v_total,
    'rooms', v_rooms,
    'document_title', v_document_title,
    'document_url', v_document_url
  );
END;
$$;
