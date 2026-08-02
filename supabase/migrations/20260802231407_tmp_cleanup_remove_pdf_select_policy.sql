-- Remove temporary cleanup policy
DROP POLICY IF EXISTS "tmp_cleanup_select_test_pdfs" ON storage.objects;
