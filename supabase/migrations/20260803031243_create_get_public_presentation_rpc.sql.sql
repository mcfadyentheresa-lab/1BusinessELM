-- Public presentation RPC: the single anon-callable entry point
-- for public share links (/present/:token).
--
-- Takes a share token, validates it (exists + not expired), resolves
-- the project it unlocks via planning_boards, and returns a curated
-- JSON payload for that one project only. Returns NULL for any
-- failure (invalid / expired / nonexistent token) with no error
-- that could distinguish between cases.
--
-- SECURITY: SECURITY DEFINER + SET search_path = '' to match the
-- hardening standard established for get_my_role,
-- sync_profile_role_to_app_metadata, and handle_new_user. Every
-- table reference is schema-qualified (public.*) so the locked-down
-- search path doesn't break resolution. This is anon-callable, so
-- it gets at least the same rigor as the internal trigger functions.

CREATE OR REPLACE FUNCTION public.get_public_presentation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id integer;
BEGIN
  -- Validate the token and resolve which project it unlocks.
  -- Token must exist AND not be expired (expires_at IS NULL = never expires).
  SELECT b.project_id
    INTO v_project_id
    FROM public.board_presentation_tokens t
    JOIN public.planning_boards b ON b.id = t.board_id
   WHERE t.token = p_token
     AND (t.expires_at IS NULL OR t.expires_at > now())
   LIMIT 1;

  -- Invalid / expired / nonexistent token → return NULL.
  -- No exception is raised. All failure cases collapse to the same
  -- NULL outcome so the caller cannot distinguish between them.
  IF v_project_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Assemble the joined payload for that one project only.
  -- Every subquery is filtered to v_project_id — the value resolved
  -- from the token, never from caller-supplied input.
  RETURN jsonb_build_object(
    'project', (
      SELECT jsonb_build_object(
          'id',             p.id,
          'name',           p.name,
          'description',    p.description,
          'address',        p.address,
          'city',           p.city,
          'phase',          p.phase,
          'start_date',     p.start_date,
          'end_date',       p.end_date,
          'thumbnail_url',  p.thumbnail_url,
          'hero_focal_x',   p.hero_focal_x,
          'hero_focal_y',   p.hero_focal_y,
          'hero_zoom',      p.hero_zoom
      )
        FROM public.projects p
       WHERE p.id = v_project_id
    ),
    'milestones', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id',        m.id,
            'title',     m.title,
            'date',      m.date,
            'completed', m.completed,
            'order',     m.order
        )
        ORDER BY m.order
      ), '[]'::jsonb)
        FROM public.milestones m
       WHERE m.project_id = v_project_id
    ),
    'photos', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id',      ph.id,
            'url',     ph.url,
            'caption', ph.caption
        )
        ORDER BY ph.created_at DESC
      ), '[]'::jsonb)
        FROM public.photos ph
       WHERE ph.project_id = v_project_id
       LIMIT 12
    ),
    'selections', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id',            s.id,
            'name',          s.item,
            'supplier_name', s.vendor,
            'category',      s.category,
            'notes',         s.notes
        )
        ORDER BY s.created_at
      ), '[]'::jsonb)
        FROM public.selections s
       WHERE s.project_id = v_project_id
         AND s.archived = false
    )
  );
END;
$$;

-- Revoke default PUBLIC execute, then grant only to the roles that
-- need it: anon (the public share-link visitor) and authenticated
-- (in case a signed-in user opens a share link).
REVOKE EXECUTE ON FUNCTION public.get_public_presentation(p_token text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_presentation(p_token text) TO anon, authenticated;