-- Remove the temporary SELECT policy used for storage cleanup
DROP POLICY IF EXISTS "tmp_cleanup_select_test_objects" ON storage.objects;
