-- ConveyX Phase 2 — ONE-FILE setup (run entire file in Supabase SQL Editor)
-- Creates order + billing schemas, tables, and RPC functions.

-- ========== 1. ORDER SCHEMA ==========
CREATE SCHEMA IF NOT EXISTS cx_order;

CREATE TABLE IF NOT EXISTS cx_order.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'pending_payment', 'paid', 'fulfilling', 'completed', 'failed', 'cancelled'
  )),
  property_address TEXT NOT NULL,
  property_context JSONB NOT NULL DEFAULT '{}',
  include_body_corp BOOLEAN NOT NULL DEFAULT false,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_entity ON cx_order.orders(entity_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON cx_order.orders(status);

CREATE TABLE IF NOT EXISTS cx_order.order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES cx_order.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_type TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL,
  required_data_buyer JSONB DEFAULT '{}',
  required_data_seller JSONB DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_lines_order ON cx_order.order_lines(order_id);

CREATE OR REPLACE FUNCTION cx_order.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON cx_order.orders;
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON cx_order.orders
  FOR EACH ROW EXECUTE FUNCTION cx_order.set_updated_at();

GRANT USAGE ON SCHEMA cx_order TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cx_order TO postgres, service_role;

-- ========== 2. BILLING SCHEMA ==========
CREATE SCHEMA IF NOT EXISTS billing;

CREATE TABLE IF NOT EXISTS billing.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  reference TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid', 'void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_entity ON billing.transactions(entity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON billing.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_order ON billing.transactions(order_id);

CREATE TABLE IF NOT EXISTS billing.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_entity ON billing.invoices(entity_id);

CREATE TABLE IF NOT EXISTS billing.invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES billing.invoices(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES billing.transactions(id),
  order_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON billing.invoice_lines(invoice_id);
CREATE SEQUENCE IF NOT EXISTS billing.invoice_number_seq START 1000;

CREATE OR REPLACE FUNCTION billing.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_updated_at ON billing.transactions;
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON billing.transactions
  FOR EACH ROW EXECUTE FUNCTION billing.set_updated_at();
DROP TRIGGER IF EXISTS invoices_updated_at ON billing.invoices;
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON billing.invoices
  FOR EACH ROW EXECUTE FUNCTION billing.set_updated_at();

GRANT USAGE ON SCHEMA billing TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA billing TO postgres, service_role;

-- ========== 3. RPC FUNCTIONS ==========

CREATE OR REPLACE FUNCTION public.cx_list_orders(
  p_entity_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_product text DEFAULT NULL,
  p_customer text DEFAULT NULL
)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = cx_order, customer, public AS $$
  WITH filtered AS (
    SELECT
      o.*,
      e.name AS customer_name,
      coalesce((
        SELECT json_agg(l.product_name ORDER BY l.sort_order)
        FROM cx_order.order_lines l
        WHERE l.order_id = o.id
      ), '[]'::json) AS product_names
    FROM cx_order.orders o
    LEFT JOIN customer.entities e ON e.id = o.entity_id
    WHERE (p_entity_id IS NULL OR o.entity_id = p_entity_id)
      AND (p_status IS NULL OR o.status = p_status)
      AND (
        p_customer IS NULL OR btrim(p_customer) = ''
        OR coalesce(e.name, '') ILIKE '%' || btrim(p_customer) || '%'
      )
      AND (
        p_product IS NULL OR btrim(p_product) = ''
        OR EXISTS (
          SELECT 1 FROM cx_order.order_lines l
          WHERE l.order_id = o.id
            AND (
              l.product_name ILIKE '%' || btrim(p_product) || '%'
              OR l.sku ILIKE '%' || btrim(p_product) || '%'
            )
        )
      )
      AND (
        p_q IS NULL OR btrim(p_q) = ''
        OR o.id::text ILIKE '%' || replace(btrim(p_q), '-', '') || '%'
        OR replace(o.id::text, '-', '') ILIKE '%' || regexp_replace(lower(btrim(p_q)), '^ord-?', '') || '%'
        OR o.property_address ILIKE '%' || btrim(p_q) || '%'
        OR coalesce(e.name, '') ILIKE '%' || btrim(p_q) || '%'
        OR EXISTS (
          SELECT 1 FROM cx_order.order_lines l
          WHERE l.order_id = o.id
            AND (
              l.product_name ILIKE '%' || btrim(p_q) || '%'
              OR l.sku ILIKE '%' || btrim(p_q) || '%'
            )
        )
      )
  )
  SELECT coalesce(
    json_agg(
      to_jsonb(f) - 'customer_name' - 'product_names'
      || jsonb_build_object('customer_name', f.customer_name, 'product_names', f.product_names)
      ORDER BY f.created_at DESC
    ),
    '[]'::json
  )
  FROM filtered f;
$$;

CREATE OR REPLACE FUNCTION public.cx_get_order(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = cx_order, public AS $$
DECLARE v_order cx_order.orders; v_lines json;
BEGIN
  SELECT * INTO v_order FROM cx_order.orders WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(json_agg(l ORDER BY l.sort_order), '[]'::json) INTO v_lines
  FROM cx_order.order_lines l WHERE l.order_id = p_id;
  RETURN json_build_object('order', to_json(v_order), 'lines', v_lines);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_create_order(p_data jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = cx_order, public AS $$
DECLARE v_order cx_order.orders; v_line jsonb;
  v_subtotal numeric := 0; v_gst numeric := 0; v_total numeric := 0;
  v_unit numeric; v_gst_amt numeric; v_line_total numeric; v_sort int := 0;
BEGIN
  INSERT INTO cx_order.orders (entity_id, property_address, property_context, include_body_corp, status)
  VALUES (
    (p_data->>'entity_id')::uuid, p_data->>'property_address',
    coalesce(p_data->'property_context', '{}'),
    coalesce((p_data->>'include_body_corp')::boolean, false),
    coalesce(p_data->>'status', 'draft')
  ) RETURNING * INTO v_order;

  FOR v_line IN SELECT * FROM jsonb_array_elements(coalesce(p_data->'lines', '[]'::jsonb))
  LOOP
    v_unit := (v_line->>'unit_price')::numeric;
    v_gst_amt := coalesce((v_line->>'gst_amount')::numeric, 0);
    v_line_total := v_unit * coalesce((v_line->>'quantity')::int, 1) + v_gst_amt;
    v_subtotal := v_subtotal + v_unit * coalesce((v_line->>'quantity')::int, 1);
    v_gst := v_gst + v_gst_amt; v_total := v_total + v_line_total;
    INSERT INTO cx_order.order_lines (
      order_id, product_id, product_name, sku, product_type, quantity,
      unit_price, gst_amount, line_total, required_data_buyer, required_data_seller, sort_order
    ) VALUES (
      v_order.id, (v_line->>'product_id')::uuid, v_line->>'product_name', v_line->>'sku',
      v_line->>'product_type', coalesce((v_line->>'quantity')::int, 1),
      v_unit, v_gst_amt, v_line_total,
      coalesce(v_line->'required_data_buyer', '{}'), coalesce(v_line->'required_data_seller', '{}'), v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;
  UPDATE cx_order.orders SET subtotal = v_subtotal, gst_total = v_gst, total = v_total
  WHERE id = v_order.id RETURNING * INTO v_order;
  RETURN public.cx_get_order(v_order.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_submit_order(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = cx_order, billing, public AS $$
DECLARE v_order cx_order.orders; v_ref text;
BEGIN
  SELECT * INTO v_order FROM cx_order.orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_order.status != 'draft' THEN RAISE EXCEPTION 'Order cannot be submitted from status %', v_order.status; END IF;
  UPDATE cx_order.orders SET status = 'submitted' WHERE id = p_id RETURNING * INTO v_order;
  v_ref := 'ORD-' || upper(substr(replace(p_id::text, '-', ''), 1, 8));
  INSERT INTO billing.transactions (order_id, entity_id, reference, description, amount, gst_amount, total, status)
  VALUES (p_id, v_order.entity_id, v_ref, 'Order ' || v_ref || ' — ' || v_order.property_address,
    v_order.subtotal, v_order.gst_total, v_order.total, 'pending');
  RETURN public.cx_get_order(p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_list_transactions(p_entity_id uuid DEFAULT NULL, p_status text DEFAULT NULL)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = billing, public AS $$
  SELECT coalesce(json_agg(t ORDER BY t.created_at DESC), '[]'::json)
  FROM billing.transactions t
  WHERE (p_entity_id IS NULL OR t.entity_id = p_entity_id) AND (p_status IS NULL OR t.status = p_status);
$$;

CREATE OR REPLACE FUNCTION public.cx_list_invoices(p_entity_id uuid DEFAULT NULL)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = billing, public AS $$
  SELECT coalesce(json_agg(i ORDER BY i.created_at DESC), '[]'::json)
  FROM billing.invoices i WHERE p_entity_id IS NULL OR i.entity_id = p_entity_id;
$$;

CREATE OR REPLACE FUNCTION public.cx_get_invoice(p_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = billing, public AS $$
DECLARE v_inv billing.invoices; v_lines json;
BEGIN
  SELECT * INTO v_inv FROM billing.invoices WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(json_agg(l ORDER BY l.created_at), '[]'::json) INTO v_lines
  FROM billing.invoice_lines l WHERE l.invoice_id = p_id;
  RETURN json_build_object('invoice', to_json(v_inv), 'lines', v_lines);
END;
$$;

CREATE OR REPLACE FUNCTION public.cx_generate_invoice(p_entity_id uuid, p_transaction_ids uuid[] DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = billing, public AS $$
DECLARE v_inv billing.invoices; v_num text;
  v_subtotal numeric := 0; v_gst numeric := 0; v_total numeric := 0; v_tx billing.transactions;
BEGIN
  v_num := 'INV-' || to_char(now(), 'YYYYMM') || '-' || nextval('billing.invoice_number_seq');
  INSERT INTO billing.invoices (entity_id, invoice_number, status) VALUES (p_entity_id, v_num, 'issued') RETURNING * INTO v_inv;
  FOR v_tx IN SELECT * FROM billing.transactions WHERE entity_id = p_entity_id AND status = 'pending'
    AND (p_transaction_ids IS NULL OR id = ANY(p_transaction_ids)) FOR UPDATE
  LOOP
    INSERT INTO billing.invoice_lines (invoice_id, transaction_id, order_id, description, amount, gst_amount, line_total)
    VALUES (v_inv.id, v_tx.id, v_tx.order_id, v_tx.description, v_tx.amount, v_tx.gst_amount, v_tx.total);
    v_subtotal := v_subtotal + v_tx.amount; v_gst := v_gst + v_tx.gst_amount; v_total := v_total + v_tx.total;
    UPDATE billing.transactions SET status = 'invoiced' WHERE id = v_tx.id;
  END LOOP;
  IF v_total = 0 THEN DELETE FROM billing.invoices WHERE id = v_inv.id; RAISE EXCEPTION 'No pending transactions to invoice'; END IF;
  UPDATE billing.invoices SET subtotal = v_subtotal, gst_total = v_gst, total = v_total, issued_at = NOW()
  WHERE id = v_inv.id RETURNING * INTO v_inv;
  RETURN public.cx_get_invoice(v_inv.id);
END;
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Verify
SELECT 'cx_order.orders' AS check, count(*)::int AS rows FROM cx_order.orders
UNION ALL SELECT 'billing.transactions', count(*)::int FROM billing.transactions;
