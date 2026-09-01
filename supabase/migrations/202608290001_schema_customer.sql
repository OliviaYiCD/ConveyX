CREATE SCHEMA IF NOT EXISTS customer;

CREATE TABLE customer.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('master', 'branch')),
  parent_entity_id UUID REFERENCES customer.entities(id),
  abn TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entities_parent ON customer.entities(parent_entity_id);
CREATE INDEX idx_entities_type ON customer.entities(entity_type);

CREATE TABLE customer.entity_settings (
  entity_id UUID PRIMARY KEY REFERENCES customer.entities(id) ON DELETE CASCADE,
  billing_preference TEXT NOT NULL DEFAULT 'invoice'
    CHECK (billing_preference IN ('invoice', 'card')),
  billing_cycle TEXT CHECK (billing_cycle IN ('weekly', 'fortnightly', 'monthly')),
  payment_terms_days INTEGER NOT NULL DEFAULT 14,
  stripe_customer_id TEXT,
  invoice_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION customer.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entities_updated_at
  BEFORE UPDATE ON customer.entities
  FOR EACH ROW EXECUTE FUNCTION customer.set_updated_at();

CREATE TRIGGER entity_settings_updated_at
  BEFORE UPDATE ON customer.entity_settings
  FOR EACH ROW EXECUTE FUNCTION customer.set_updated_at();

GRANT USAGE ON SCHEMA customer TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA customer TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA customer TO anon, authenticated;
