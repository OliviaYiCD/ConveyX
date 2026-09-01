-- ConveyX provider upgrade — RUN THIS ENTIRE FILE in Supabase SQL Editor
-- Fixes: "Could not find function public.cx_list_providers(...)"

-- ========== 1. SCHEMA ==========
ALTER TABLE sku.providers ADD COLUMN IF NOT EXISTS provider_type TEXT
  CHECK (provider_type IS NULL OR provider_type IN (
    'LGA', 'BodyCorp', 'LandInfo', 'State_government', 'Utility', 'Other'
  ));

ALTER TABLE sku.providers ADD COLUMN IF NOT EXISTS state TEXT
  CHECK (state IS NULL OR state IN ('QLD', 'VIC', 'NSW', 'SA', 'WA', 'NT', 'ACT', 'TAS'));

ALTER TABLE sku.providers ADD COLUMN IF NOT EXISTS website TEXT;

CREATE INDEX IF NOT EXISTS idx_providers_state ON sku.providers(state);
CREATE INDEX IF NOT EXISTS idx_providers_type ON sku.providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_providers_name ON sku.providers(provider_name);

-- ========== 2. RPC FUNCTIONS ==========

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

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Verify
SELECT 'cx_list_providers' AS check, count(*)::int AS providers FROM sku.providers;

