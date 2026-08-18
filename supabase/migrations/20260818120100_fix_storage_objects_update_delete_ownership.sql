/*
  # Fix storage.objects UPDATE/DELETE policies — no ownership check

  ## Problem
  "Authenticated users can update assets" and "Authenticated users can
  delete assets" checked only bucket_id = 'project-assets', with no
  ownership or project check at all. Any authenticated user — including
  the lowest-privilege 'client' role — could modify or delete any file in
  the shared bucket, including files belonging to other projects or other
  users. The original migration's own comment admitted the real intent:
  "(admins/crew only in practice via app logic)" — enforcement was assumed
  at the application layer and never actually existed at the RLS layer.

  Confirmed live via a local RLS test harness: a simulated 'client'-role
  user successfully deleted a file owned by an entirely different user
  under the pre-fix policy.

  ## Why ownership (owner), not project scoping
  The upload path convention (uploads/{timestamp}_{random}.{ext}, see
  src/hooks/use-upload.ts) carries no project or user identifier at all —
  true per-project scoping isn't achievable from the existing path/schema
  without also changing the upload convention, which is a larger change
  out of scope for this fix. What Supabase Storage does reliably track is
  storage.objects.owner, set automatically to the uploader's auth.uid() at
  upload time. Scoping to owner-or-admin/crew directly closes the
  cross-user/cross-project modification gap using data that already
  exists, and matches the admin/crew access pattern used on every other
  table in this schema.

  ## Solution
  Replace both policies with a check that the caller either owns the file
  or holds the admin/crew role.
*/

DROP POLICY IF EXISTS "Authenticated users can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete assets" ON storage.objects;

CREATE POLICY "Owners and admins/crew can update assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'project-assets' AND (owner = auth.uid() OR public.get_my_role() = ANY (ARRAY['admin','crew'])))
  WITH CHECK (bucket_id = 'project-assets' AND (owner = auth.uid() OR public.get_my_role() = ANY (ARRAY['admin','crew'])));

CREATE POLICY "Owners and admins/crew can delete assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'project-assets' AND (owner = auth.uid() OR public.get_my_role() = ANY (ARRAY['admin','crew'])));
