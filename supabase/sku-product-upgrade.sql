-- ConveyX product list upgrade — RUN THIS ENTIRE FILE in Supabase SQL Editor
-- Adds pagination to cx_list_products and product delete.

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

CREATE OR REPLACE FUNCTION public.cx_delete_product(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = sku, public AS $$
DECLARE
  v sku.products;
  v_orders int := 0;
BEGIN
  SELECT * INTO v FROM sku.products WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Soft block if referenced by order lines (orders schema may or may not exist).
  IF to_regclass('orders.order_lines') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM orders.order_lines WHERE product_id = $1'
      INTO v_orders
      USING p_id;
  END IF;

  IF v_orders > 0 THEN
    RAISE EXCEPTION 'Cannot delete product "%" (%) — % order line(s) reference it',
      v.product_name, v.sku, v_orders;
  END IF;

  -- package_items cascade via FK ON DELETE CASCADE
  DELETE FROM sku.products WHERE id = p_id;
  RETURN to_json(v);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cx_list_products(text, text, text, boolean, text, text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.cx_delete_product(uuid) TO service_role;

-- Verify
SELECT 'cx_list_products' AS check, (public.cx_list_products(NULL, NULL, NULL, NULL, NULL, NULL, 1, 0)->>'total')::int AS product_total;
