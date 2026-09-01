-- ConveyX SKU RPC API — run after sku-schema.sql (+ sku-seed.sql optional)

-- Providers
CREATE OR REPLACE FUNCTION public.cx_list_providers(
  p_search text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_provider_type text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE
  v_total int;
  v_items json;
BEGIN
  SELECT count(*) INTO v_total
  FROM sku.providers p
  WHERE (p_state IS NULL OR btrim(p_state) = '' OR p.state = p_state)
    AND (p_provider_type IS NULL OR btrim(p_provider_type) = '' OR p.provider_type = p_provider_type)
    AND (
      p_search IS NULL OR btrim(p_search) = ''
      OR p.provider_name ILIKE '%' || btrim(p_search) || '%'
      OR coalesce(p.description, '') ILIKE '%' || btrim(p_search) || '%'
      OR coalesce(p.email, '') ILIKE '%' || btrim(p_search) || '%'
      OR coalesce(p.contact_number, '') ILIKE '%' || btrim(p_search) || '%'
      OR coalesce(p.website, '') ILIKE '%' || btrim(p_search) || '%'
      OR p.provider_id::text ILIKE '%' || replace(btrim(p_search), '-', '') || '%'
    );

  SELECT coalesce(json_agg(to_json(p) ORDER BY p.provider_name), '[]'::json) INTO v_items
  FROM (
    SELECT *
    FROM sku.providers p
    WHERE (p_state IS NULL OR btrim(p_state) = '' OR p.state = p_state)
      AND (p_provider_type IS NULL OR btrim(p_provider_type) = '' OR p.provider_type = p_provider_type)
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR p.provider_name ILIKE '%' || btrim(p_search) || '%'
        OR coalesce(p.description, '') ILIKE '%' || btrim(p_search) || '%'
        OR coalesce(p.email, '') ILIKE '%' || btrim(p_search) || '%'
        OR coalesce(p.contact_number, '') ILIKE '%' || btrim(p_search) || '%'
        OR coalesce(p.website, '') ILIKE '%' || btrim(p_search) || '%'
        OR p.provider_id::text ILIKE '%' || replace(btrim(p_search), '-', '') || '%'
      )
    ORDER BY p.provider_name
    LIMIT greatest(coalesce(p_limit, 50), 1)
    OFFSET greatest(coalesce(p_offset, 0), 0)
  ) p;

  RETURN json_build_object('items', v_items, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_get_provider(p_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  SELECT to_json(p) FROM sku.providers p WHERE p.provider_id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_create_provider(
  p_provider_name text,
  p_provider_type text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_payment_details jsonb DEFAULT '{}',
  p_description text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_contact_number text DEFAULT NULL,
  p_website text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE v sku.providers;
BEGIN
  INSERT INTO sku.providers (
    provider_name, provider_type, state, payment_method, payment_details,
    description, address, email, contact_number, website
  ) VALUES (
    p_provider_name, p_provider_type, p_state, p_payment_method,
    coalesce(p_payment_details, '{}'), p_description, p_address, p_email,
    p_contact_number, p_website
  ) RETURNING * INTO v;
  RETURN to_json(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_update_provider(
  p_id uuid,
  p_provider_name text DEFAULT NULL,
  p_provider_type text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_payment_details jsonb DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_contact_number text DEFAULT NULL,
  p_website text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE v sku.providers;
BEGIN
  UPDATE sku.providers SET
    provider_name = coalesce(p_provider_name, provider_name),
    provider_type = coalesce(p_provider_type, provider_type),
    state = coalesce(p_state, state),
    payment_method = coalesce(p_payment_method, payment_method),
    payment_details = coalesce(p_payment_details, payment_details),
    description = coalesce(p_description, description),
    address = coalesce(p_address, address),
    email = coalesce(p_email, email),
    contact_number = coalesce(p_contact_number, contact_number),
    website = coalesce(p_website, website)
  WHERE provider_id = p_id RETURNING * INTO v;
  RETURN to_json(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_delete_provider(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE v sku.providers;
  v_used int;
BEGIN
  SELECT * INTO v FROM sku.providers WHERE provider_id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_used FROM sku.products WHERE provider_id = p_id;
  IF v_used > 0 THEN
    RAISE EXCEPTION 'Cannot delete provider "%" — % product(s) still reference it', v.provider_name, v_used;
  END IF;

  DELETE FROM sku.providers WHERE provider_id = p_id;
  RETURN to_json(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_delete_unused_providers()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE v_deleted int;
BEGIN
  DELETE FROM sku.providers p
  WHERE NOT EXISTS (SELECT 1 FROM sku.products pr WHERE pr.provider_id = p.provider_id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN json_build_object('deleted', v_deleted);
END;
$$;

-- Required data
CREATE OR REPLACE FUNCTION public.cx_list_required_data()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  SELECT coalesce(json_agg(r ORDER BY r.field_id), '[]'::json) FROM sku.required_data r;
$$;

CREATE OR REPLACE FUNCTION public.cx_get_required_data(p_field_id int)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  SELECT to_json(r) FROM sku.required_data r WHERE r.field_id = p_field_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_create_required_data(
  p_field_name text, p_field_type text, p_field_key text,
  p_validation_rules jsonb DEFAULT '{}', p_metadata jsonb DEFAULT '{}'
)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  INSERT INTO sku.required_data (field_name, field_type, field_key, validation_rules, metadata)
  VALUES (p_field_name, p_field_type, p_field_key, coalesce(p_validation_rules, '{}'), coalesce(p_metadata, '{}'))
  RETURNING to_json(sku.required_data.*);
$$;

CREATE OR REPLACE FUNCTION public.cx_delete_required_data(p_field_id int)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE v sku.required_data;
BEGIN
  SELECT * INTO v FROM sku.required_data WHERE field_id = p_field_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE sku.products SET
    required_data_buyer = array_remove(required_data_buyer, p_field_id),
    required_data_seller = array_remove(required_data_seller, p_field_id)
  WHERE p_field_id = ANY(required_data_buyer) OR p_field_id = ANY(required_data_seller);

  DELETE FROM sku.required_data WHERE field_id = p_field_id;
  RETURN to_json(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_batch_required_data(p_field_ids int[])
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  SELECT coalesce(json_agg(r ORDER BY r.field_id), '[]'::json)
  FROM sku.required_data r WHERE r.field_id = ANY(p_field_ids);
$$;

-- Councils
CREATE OR REPLACE FUNCTION public.cx_list_councils(p_state text DEFAULT NULL)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  SELECT coalesce(json_agg(c ORDER BY c.state, c.name), '[]'::json)
  FROM sku.councils c
  WHERE p_state IS NULL OR c.state = p_state;
$$;

-- Products
CREATE OR REPLACE FUNCTION public.cx_list_products(
  p_state text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_council text DEFAULT NULL,
  p_display_on_ui boolean DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE
  v_total int;
  v_items json;
BEGIN
  SELECT count(*) INTO v_total
  FROM sku.products p
  WHERE (p_state IS NULL OR btrim(p_state) = '' OR p.state = p_state)
    AND (p_type IS NULL OR btrim(p_type) = '' OR p.type = p_type)
    AND (p_council IS NULL OR btrim(p_council) = '' OR p.council = p_council)
    AND (p_display_on_ui IS NULL OR p.display_on_ui = p_display_on_ui)
    AND (p_status IS NULL OR btrim(p_status) = '' OR p.status = p_status)
    AND (
      p_search IS NULL OR btrim(p_search) = ''
      OR p.product_name ILIKE '%' || btrim(p_search) || '%'
      OR p.sku ILIKE '%' || btrim(p_search) || '%'
      OR coalesce(p.description, '') ILIKE '%' || btrim(p_search) || '%'
      OR coalesce(p.council, '') ILIKE '%' || btrim(p_search) || '%'
      OR p.id::text ILIKE '%' || replace(btrim(p_search), '-', '') || '%'
      OR p.provider_id::text ILIKE '%' || replace(btrim(p_search), '-', '') || '%'
    );

  SELECT coalesce(json_agg(to_json(p) ORDER BY p.created_at DESC), '[]'::json) INTO v_items
  FROM (
    SELECT *
    FROM sku.products p
    WHERE (p_state IS NULL OR btrim(p_state) = '' OR p.state = p_state)
      AND (p_type IS NULL OR btrim(p_type) = '' OR p.type = p_type)
      AND (p_council IS NULL OR btrim(p_council) = '' OR p.council = p_council)
      AND (p_display_on_ui IS NULL OR p.display_on_ui = p_display_on_ui)
      AND (p_status IS NULL OR btrim(p_status) = '' OR p.status = p_status)
      AND (
        p_search IS NULL OR btrim(p_search) = ''
        OR p.product_name ILIKE '%' || btrim(p_search) || '%'
        OR p.sku ILIKE '%' || btrim(p_search) || '%'
        OR coalesce(p.description, '') ILIKE '%' || btrim(p_search) || '%'
        OR coalesce(p.council, '') ILIKE '%' || btrim(p_search) || '%'
        OR p.id::text ILIKE '%' || replace(btrim(p_search), '-', '') || '%'
        OR p.provider_id::text ILIKE '%' || replace(btrim(p_search), '-', '') || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT greatest(1, least(coalesce(p_limit, 50), 10000))
    OFFSET greatest(0, coalesce(p_offset, 0))
  ) p;

  RETURN json_build_object('items', v_items, 'total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_get_product(p_id uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  SELECT to_json(p) FROM sku.products p WHERE p.id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_get_product_by_sku(p_sku text)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  SELECT to_json(p) FROM sku.products p WHERE p.sku = p_sku;
$$;

CREATE OR REPLACE FUNCTION public.cx_create_product(p_data jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE v sku.products;
BEGIN
  INSERT INTO sku.products (
    product_name, sku, state, type, display_on_ui, description, council, provider_id,
    required_data_buyer, required_data_seller, cost, retail_price, gst_option, gst_amount,
    fulfillment_method, status
  ) VALUES (
    p_data->>'product_name',
    p_data->>'sku',
    p_data->>'state',
    p_data->>'type',
    coalesce((p_data->>'display_on_ui')::boolean, true),
    p_data->>'description',
    coalesce(p_data->>'council', 'ALL'),
    (p_data->>'provider_id')::uuid,
    coalesce(ARRAY(SELECT jsonb_array_elements_text(p_data->'required_data_buyer'))::int[], '{}'),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(p_data->'required_data_seller'))::int[], '{}'),
    (p_data->>'cost')::numeric,
    (p_data->>'retail_price')::numeric,
    p_data->>'gst_option',
    NULLIF(p_data->>'gst_amount', '')::numeric,
    p_data->>'fulfillment_method',
    coalesce(p_data->>'status', 'draft')
  ) RETURNING * INTO v;
  RETURN to_json(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_update_product(p_id uuid, p_data jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE v sku.products;
BEGIN
  UPDATE sku.products SET
    product_name = coalesce(p_data->>'product_name', product_name),
    sku = coalesce(p_data->>'sku', sku),
    state = coalesce(p_data->>'state', state),
    type = coalesce(p_data->>'type', type),
    display_on_ui = coalesce((p_data->>'display_on_ui')::boolean, display_on_ui),
    description = coalesce(p_data->>'description', description),
    council = coalesce(p_data->>'council', council),
    provider_id = coalesce((p_data->>'provider_id')::uuid, provider_id),
    required_data_buyer = CASE WHEN p_data ? 'required_data_buyer'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'required_data_buyer'))::int[] ELSE required_data_buyer END,
    required_data_seller = CASE WHEN p_data ? 'required_data_seller'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'required_data_seller'))::int[] ELSE required_data_seller END,
    cost = coalesce((p_data->>'cost')::numeric, cost),
    retail_price = coalesce((p_data->>'retail_price')::numeric, retail_price),
    gst_option = coalesce(p_data->>'gst_option', gst_option),
    gst_amount = CASE WHEN p_data ? 'gst_amount' THEN NULLIF(p_data->>'gst_amount', '')::numeric ELSE gst_amount END,
    fulfillment_method = coalesce(p_data->>'fulfillment_method', fulfillment_method),
    status = coalesce(p_data->>'status', status)
  WHERE id = p_id RETURNING * INTO v;
  RETURN to_json(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_delete_product(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE
  v sku.products;
  v_orders int := 0;
BEGIN
  SELECT * INTO v FROM sku.products WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF to_regclass('orders.order_lines') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM orders.order_lines WHERE product_id = $1'
      INTO v_orders
      USING p_id;
  END IF;

  IF v_orders > 0 THEN
    RAISE EXCEPTION 'Cannot delete product "%" (%) — % order line(s) reference it',
      v.product_name, v.sku, v_orders;
  END IF;

  DELETE FROM sku.products WHERE id = p_id;
  RETURN to_json(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_set_product_status(p_id uuid, p_status text)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  UPDATE sku.products SET status = p_status WHERE id = p_id
  RETURNING to_json(sku.products.*);
$$;

-- Packages
CREATE OR REPLACE FUNCTION public.cx_list_packages(
  p_scope_type text DEFAULT NULL,
  p_scope_state text DEFAULT NULL,
  p_scope_council text DEFAULT NULL,
  p_display_on_ui boolean DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  SELECT coalesce(json_agg(pkg ORDER BY pkg.created_at DESC), '[]'::json)
  FROM sku.packages pkg
  WHERE (p_scope_type IS NULL OR pkg.scope_type = p_scope_type)
    AND (p_scope_state IS NULL OR pkg.scope_state = p_scope_state)
    AND (p_scope_council IS NULL OR pkg.scope_council = p_scope_council)
    AND (p_display_on_ui IS NULL OR pkg.display_on_ui = p_display_on_ui)
    AND (p_status IS NULL OR pkg.status = p_status);
$$;

CREATE OR REPLACE FUNCTION public.cx_get_package(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE v_pkg sku.packages;
  v_items json;
BEGIN
  SELECT * INTO v_pkg FROM sku.packages WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(json_agg(
    json_build_object(
      'product_id', pi.product_id,
      'sort_order', pi.sort_order,
      'is_optional', pi.is_optional,
      'product', row_to_json(p.*)
    ) ORDER BY pi.sort_order
  ), '[]'::json) INTO v_items
  FROM sku.package_items pi
  JOIN sku.products p ON p.id = pi.product_id
  WHERE pi.package_id = p_id;
  RETURN json_build_object('package', to_json(v_pkg), 'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_create_package(p_data jsonb)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  INSERT INTO sku.packages (
    package_name, description, scope_type, scope_state, scope_council, display_on_ui, status
  ) VALUES (
    p_data->>'package_name',
    p_data->>'description',
    p_data->>'scope_type',
    NULLIF(p_data->>'scope_state', ''),
    NULLIF(p_data->>'scope_council', ''),
    coalesce((p_data->>'display_on_ui')::boolean, true),
    coalesce(p_data->>'status', 'draft')
  ) RETURNING to_json(sku.packages.*);
$$;

CREATE OR REPLACE FUNCTION public.cx_update_package(p_id uuid, p_data jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE v sku.packages;
BEGIN
  UPDATE sku.packages SET
    package_name = coalesce(p_data->>'package_name', package_name),
    description = coalesce(p_data->>'description', description),
    scope_type = coalesce(p_data->>'scope_type', scope_type),
    scope_state = CASE WHEN p_data ? 'scope_state' THEN NULLIF(p_data->>'scope_state', '') ELSE scope_state END,
    scope_council = CASE WHEN p_data ? 'scope_council' THEN NULLIF(p_data->>'scope_council', '') ELSE scope_council END,
    display_on_ui = coalesce((p_data->>'display_on_ui')::boolean, display_on_ui),
    status = coalesce(p_data->>'status', status)
  WHERE id = p_id RETURNING * INTO v;
  RETURN to_json(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_set_package_items(p_package_id uuid, p_items jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE item jsonb;
BEGIN
  DELETE FROM sku.package_items WHERE package_id = p_package_id;
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sku.package_items (package_id, product_id, sort_order, is_optional)
    VALUES (
      p_package_id,
      (item->>'product_id')::uuid,
      coalesce((item->>'sort_order')::int, 0),
      coalesce((item->>'is_optional')::boolean, false)
    );
  END LOOP;
  RETURN public.cx_get_package(p_package_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_set_package_status(p_id uuid, p_status text)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = sku, public AS $$
  UPDATE sku.packages SET status = p_status WHERE id = p_id
  RETURNING to_json(sku.packages.*);
$$;

-- Extend health check
CREATE OR REPLACE FUNCTION public.cx_health_check()
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = customer, sku, public AS $$
  SELECT json_build_object(
    'ok', true,
    'entity_count', (SELECT count(*)::int FROM customer.entities),
    'product_count', (SELECT count(*)::int FROM sku.products),
    'council_count', (SELECT count(*)::int FROM sku.councils)
  );
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
