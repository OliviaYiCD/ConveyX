INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('fulfillment-docs', 'fulfillment-docs', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('contracts', 'contracts', false, 52428800, ARRAY['application/pdf']),
  ('signed-docs', 'signed-docs', false, 52428800, ARRAY['application/pdf']),
  ('invoices', 'invoices', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
