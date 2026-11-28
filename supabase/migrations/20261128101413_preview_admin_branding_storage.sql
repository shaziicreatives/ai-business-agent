-- Preview-only storage bootstrap for the existing admin branding feature.
-- The bucket is public for logo/favicon reads; uploads are restricted to active admins.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('admin-branding','admin-branding',true,2097152,ARRAY['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon','image/vnd.microsoft.icon'])
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,
  public=EXCLUDED.public,
  file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE POLICY "Authorized admins upload branding assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'admin-branding'
  AND (storage.foldername(name))[1] = 'brand-assets'
  AND (SELECT private.is_active_admin_for_branding())
);
