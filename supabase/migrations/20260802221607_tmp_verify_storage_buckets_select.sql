-- Temporary: Add SELECT policy on storage.buckets so the storage API can
-- read bucket metadata during uploads. This is needed because RLS is enabled
-- on storage.buckets but no policies exist, making all buckets invisible.
-- This will be removed after verification.
CREATE POLICY "tmp_verify_buckets_select"
  ON storage.buckets FOR SELECT
  TO authenticated
  USING (true);
