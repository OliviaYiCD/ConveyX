-- ConveyX Order schema — run BEFORE order-billing-rpc-api.sql
-- Schema named cx_order (avoids SQL reserved word "order")

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
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON cx_order.orders;
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON cx_order.orders
  FOR EACH ROW EXECUTE FUNCTION cx_order.set_updated_at();

GRANT USAGE ON SCHEMA cx_order TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cx_order TO postgres, service_role;
