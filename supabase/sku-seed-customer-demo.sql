-- Additional products for customer portal demo (run after sku-seed.sql)

INSERT INTO sku.products (
  product_name, sku, state, type, display_on_ui, description, council, provider_id,
  required_data_buyer, required_data_seller, cost, retail_price, gst_option, fulfillment_method, status
) VALUES
  (
    'NSW Body Corporate Records', 'NSW-BC-001', 'NSW', 'BodyCorp', true,
    'Strata/body corporate search NSW', 'ALL', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '{1,5}', '{2}', 35.00, 65.00, 'normal_gst_10', 'Manual', 'active'
  ),
  (
    'Sydney Water Search', 'NSW-UTIL-SYD-WATER', 'NSW', 'Utility', true,
    'Water utility search Sydney area', 'SYDNEY', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '{1}', '{}', 18.00, 38.00, 'normal_gst_10', 'Automation', 'active'
  ),
  (
    'NSW Land Tax Certificate', 'NSW-STATE-LANDTAX', 'NSW', 'State_government', true,
    'NSW Revenue land tax certificate', 'ALL', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '{1,4}', '{2}', 22.00, 42.00, 'normal_gst_10', 'API', 'active'
  ),
  (
    'NSW General Property Report', 'NSW-OTHER-001', 'NSW', 'Other', true,
    'Miscellaneous NSW property report', 'ALL', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '{1}', '{}', 10.00, 25.00, 'normal_gst_10', 'Manual', 'active'
  ),
  (
    'Parramatta Rates Certificate', 'NSW-LGA-PAR-RATES', 'NSW', 'LGA', true,
    'Rates certificate City of Parramatta', 'PARRAMATTA', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '{1}', '{}', 15.00, 35.00, 'normal_gst_10', 'Manual', 'active'
  )
ON CONFLICT (sku) DO NOTHING;
