-- Fix: storage.buckets has RLS enabled but zero SELECT policies.
-- The Supabase storage API reads bucket metadata (file_size_limit,
-- allowed_mime_types, public flag) during its internal can_insert_object
-- pre-check before every upload. With RLS enabled and no policies, the
-- bucket row is invisible to authenticated users, so ALL uploads fail.
--
-- This is distinct from migration 20260620180317, which dropped the
-- SELECT policy on storage.objects (file rows) to prevent filename
-- enumeration across projects. That concern does not apply here:
-- storage.buckets contains only bucket definitions — no user data,
-- filenames, or paths. There is one bucket. Reading its metadata
-- reveals nothing an authenticated user doesn't already know.
CREATE POLICY "Authenticated users can read bucket metadata"
  ON storage.buckets FOR SELECT
  TO authenticated
  USING (true);
