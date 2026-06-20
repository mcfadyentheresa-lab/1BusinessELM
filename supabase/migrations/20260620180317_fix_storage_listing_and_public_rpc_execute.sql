-- Fix: Drop the broad authenticated SELECT policy on storage.objects.
-- Public buckets serve objects via their direct URL without any RLS SELECT
-- policy. The only effect of this policy is enabling listing of all objects
-- in the bucket, which exposes filenames/paths across all projects.
-- Authenticated users still retain INSERT / UPDATE / DELETE.
DROP POLICY IF EXISTS "Authenticated users can read assets" ON storage.objects;

-- Fix: Revoke EXECUTE from PUBLIC on sync_profile_role_to_app_metadata.
-- The previous migration revoked from anon and authenticated individually,
-- but EXECUTE was granted to PUBLIC (which subsumes all roles).
-- This function is an internal trigger callback; it must not be reachable
-- via /rest/v1/rpc by any client.
REVOKE EXECUTE ON FUNCTION public.sync_profile_role_to_app_metadata() FROM PUBLIC;
