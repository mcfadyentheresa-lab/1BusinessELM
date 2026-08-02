-- Temporary: scoped SELECT policy to clean up orphaned test PDFs
CREATE POLICY "tmp_cleanup_select_test_pdfs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (name LIKE 'uploads/%verify%');
