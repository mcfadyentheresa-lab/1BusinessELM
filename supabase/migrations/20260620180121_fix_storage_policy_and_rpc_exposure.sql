-- Fix 1: Remove broad public SELECT policy on project-assets bucket.
-- Public buckets serve object URLs without needing an RLS SELECT policy;
-- the policy only enables listing, which exposes more than intended.
-- Replace it with authenticated-only access so only logged-in users can list.
DROP POLICY IF EXISTS "Anyone can read assets" ON storage.objects;

CREATE POLICY "Authenticated users can read assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'project-assets');

-- Fix 2 & 3: Revoke EXECUTE on sync_profile_role_to_app_metadata from
-- anon and authenticated roles. This function is a SECURITY DEFINER trigger
-- function called internally by Postgres; it must not be invocable via RPC.
REVOKE EXECUTE ON FUNCTION public.sync_profile_role_to_app_metadata() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_profile_role_to_app_metadata() FROM authenticated;
