-- ConveyX Billing schema — run AFTER order-schema.sql, BEFORE order-billing-rpc-api.sql

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
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_updated_at ON billing.transactions;
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON billing.transactions
  FOR EACH ROW EXECUTE FUNCTION billing.set_updated_at();
DROP TRIGGER IF EXISTS invoices_updated_at ON billing.invoices;
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON billing.invoices
  FOR EACH ROW EXECUTE FUNCTION billing.set_updated_at();

GRANT USAGE ON SCHEMA billing TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA billing TO postgres, service_role;
