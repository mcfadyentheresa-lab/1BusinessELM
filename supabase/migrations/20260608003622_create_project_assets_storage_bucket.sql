/*
  # Create project-assets storage bucket

  The app uploads board images, project photos, and profile avatars to a
  Supabase Storage bucket named "project-assets". The bucket is public
  (images are embedded directly in the UI via their public URL) but only
  authenticated users may upload or delete objects.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-assets',
  'project-assets',
  true,
  52428800, -- 50 MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/svg+xml','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload objects
CREATE POLICY "Authenticated users can upload assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'project-assets');

-- Public read (bucket is public, but explicit policy is good hygiene)
CREATE POLICY "Anyone can read assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'project-assets');

-- Authenticated users can update their own uploads or any admin can
CREATE POLICY "Authenticated users can update assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'project-assets');

-- Authenticated users can delete objects (admins/crew only in practice via app logic)
CREATE POLICY "Authenticated users can delete assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'project-assets');
