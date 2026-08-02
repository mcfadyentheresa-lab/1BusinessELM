-- Temporary: Add a scoped SELECT policy on storage.objects so we can
-- clean up orphaned test objects via the Storage API. This is scoped to
-- the test-verification path only — NOT a broad SELECT like the old
-- "Authenticated users can read assets" policy that was removed for
-- security reasons in migration 20260620180317.
-- Will be dropped immediately after cleanup.
CREATE POLICY "tmp_cleanup_select_test_objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (name LIKE 'uploads/%verify%');
