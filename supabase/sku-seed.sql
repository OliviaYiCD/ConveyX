-- ConveyX SKU seed — run after sku-schema.sql

-- Providers
INSERT INTO sku.providers (provider_id, provider_name, payment_method, description, email)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NSW Land Registry Services', 'portal_prepay', 'NSW title and plan searches', 'orders@nswlrs.com.au'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'City of Sydney', 'invoice', 'Sydney LGA certificates', 'rates@cityofsydney.nsw.gov.au'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'ConveyX Internal', 'internal', 'Manual fulfillment placeholder', 'ops@conveyx.local')
ON CONFLICT (provider_id) DO NOTHING;

-- Required data field library
INSERT INTO sku.required_data (field_id, field_name, field_type, field_key, metadata)
VALUES
  (1, 'Buyer full name', 'text', 'buyer_full_name', '{"placeholder": "John Smith"}'),
  (2, 'Seller full name', 'text', 'seller_full_name', '{"placeholder": "Jane Doe"}'),
  (3, 'Buyer date of birth', 'date', 'buyer_dob', '{}'),
  (4, 'Company ABN', 'text', 'company_abn', '{"placeholder": "12345678901"}'),
  (5, 'Strata plan number', 'text', 'strata_plan_no', '{}')
ON CONFLICT (field_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('sku.required_data', 'field_id'), (SELECT MAX(field_id) FROM sku.required_data));

-- Councils (representative set per state; use ALL on products for statewide)
INSERT INTO sku.councils (code, name, state) VALUES
  ('SYDNEY', 'City of Sydney', 'NSW'),
  ('PARRAMATTA', 'City of Parramatta', 'NSW'),
  ('NEWCASTLE', 'City of Newcastle', 'NSW'),
  ('WOLLONGONG', 'Wollongong City Council', 'NSW'),
  ('MELBOURNE', 'City of Melbourne', 'VIC'),
  ('GEELONG', 'City of Greater Geelong', 'VIC'),
  ('BALLARAT', 'City of Ballarat', 'VIC'),
  ('BRISBANE', 'Brisbane City Council', 'QLD'),
  ('GOLD_COAST', 'City of Gold Coast', 'QLD'),
  ('SUNSHINE_COAST', 'Sunshine Coast Council', 'QLD'),
  ('ADELAIDE', 'City of Adelaide', 'SA'),
  ('ONKAPARINGA', 'City of Onkaparinga', 'SA'),
  ('PERTH', 'City of Perth', 'WA'),
  ('STIRLING', 'City of Stirling', 'WA'),
  ('HOBART', 'City of Hobart', 'TAS'),
  ('LAUNCESTON', 'City of Launceston', 'TAS'),
  ('DARWIN', 'City of Darwin', 'NT'),
  ('CANBERRA', 'ACT Government', 'ACT')
ON CONFLICT DO NOTHING;

-- Sample products
INSERT INTO sku.products (
  product_name, sku, state, type, display_on_ui, description, council, provider_id,
  required_data_buyer, required_data_seller, cost, retail_price, gst_option, fulfillment_method, status
) VALUES
  (
    'NSW Title Search', 'NSW-TITLE-001', 'NSW', 'LandInfo', true,
    'Current title search NSW', 'ALL', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '{1}', '{2}', 25.00, 45.00, 'normal_gst_10', 'API', 'active'
  ),
  (
    'Sydney Rates Certificate', 'NSW-LGA-SYD-RATES', 'NSW', 'LGA', true,
    'Rates certificate City of Sydney', 'SYDNEY', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '{1}', '{}', 15.00, 35.00, 'normal_gst_10', 'Manual', 'active'
  ),
  (
    'VIC Title Search', 'VIC-TITLE-001', 'VIC', 'LandInfo', true,
    'Current title search VIC', 'ALL', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '{1,4}', '{2}', 28.00, 48.00, 'normal_gst_10', 'Automation', 'active'
  ),
  (
    'QLD Title Search', 'QLD-TITLE-001', 'QLD', 'LandInfo', true,
    'Current title search QLD', 'ALL', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '{1}', '{2}', 26.00, 46.00, 'normal_gst_10', 'API', 'active'
  )
ON CONFLICT (sku) DO NOTHING;

-- Sample package
INSERT INTO sku.packages (id, package_name, description, scope_type, scope_state, display_on_ui, status)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'NSW Standard Purchase Package',
  'Common NSW purchase searches',
  'state', 'NSW', true, 'active'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO sku.package_items (package_id, product_id, sort_order, is_optional)
SELECT
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  p.id,
  ROW_NUMBER() OVER (ORDER BY p.sku),
  false
FROM sku.products p
WHERE p.sku IN ('NSW-TITLE-001', 'NSW-LGA-SYD-RATES')
ON CONFLICT DO NOTHING;
