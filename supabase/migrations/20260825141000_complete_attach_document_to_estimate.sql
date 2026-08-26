/*
  # Complete 20260823180000: get_client_estimate_summary never got the document fields

  ## Problem
  20260823180000_attach_document_to_estimate.sql was only partially applied
  out-of-band before this migration history was fully synced: the
  project_estimates.document_id column and attach_estimate_document()
  function both landed, but get_client_estimate_summary() was never
  replaced with the version that reads and returns document_title/
  document_url. Net effect: an admin could attach a document to an
  approved estimate, but it would never actually surface on the client's
  summary card — the read side of the feature silently never shipped.

  Confirmed live via `supabase db query --linked` before writing this file.

  ## Solution
  Re-apply exactly the one statement 20260823180000 never got to run —
  the CREATE OR REPLACE FUNCTION get_client_estimate_summary(...) body,
  unchanged from that migration.
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
