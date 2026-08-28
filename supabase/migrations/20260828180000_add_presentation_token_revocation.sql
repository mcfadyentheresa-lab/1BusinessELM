-- board_presentation_tokens has only ever had SELECT and INSERT policies —
-- there's no way for an admin to revoke a share link early once it's been
-- sent out (a forwarded link, one posted publicly, or one leaked in browser
-- history had no kill switch short of a manual DB operation). This adds the
-- missing DELETE policy so admins/crew can actually revoke a token; the
-- "Revoke" UI action itself lives in PresentationMode.tsx.

CREATE POLICY "Admins and crew can delete presentation tokens"
  ON board_presentation_tokens FOR DELETE
  TO authenticated
  USING (public.get_my_role() = ANY (ARRAY['admin', 'crew']));
