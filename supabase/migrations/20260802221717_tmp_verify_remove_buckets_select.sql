-- Remove the temporary SELECT policy on storage.buckets
DROP POLICY IF EXISTS "tmp_verify_buckets_select" ON storage.buckets;
