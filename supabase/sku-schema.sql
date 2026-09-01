-- ConveyX SKU schema — run in Supabase SQL Editor (after cloud-setup.sql)

CREATE SCHEMA IF NOT EXISTS sku;

CREATE TABLE sku.providers (
  provider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL UNIQUE,
  provider_type TEXT CHECK (provider_type IS NULL OR provider_type IN (
    'LGA', 'BodyCorp', 'LandInfo', 'State_government', 'Utility', 'Other'
  )),
  state TEXT CHECK (state IS NULL OR state IN ('QLD', 'VIC', 'NSW', 'SA', 'WA', 'NT', 'ACT', 'TAS')),
  payment_method TEXT,
  payment_details JSONB DEFAULT '{}',
  description TEXT,
  address TEXT,
  email TEXT,
  contact_number TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_providers_state ON sku.providers(state);
CREATE INDEX idx_providers_type ON sku.providers(provider_type);
CREATE INDEX idx_providers_name ON sku.providers(provider_name);

CREATE TABLE sku.required_data (
  field_id SERIAL PRIMARY KEY,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'binary', 'date', 'select', 'boolean')),
  field_key TEXT NOT NULL UNIQUE,
  validation_rules JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sku.councils (
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('QLD', 'VIC', 'NSW', 'SA', 'WA', 'NT', 'ACT', 'TAS')),
  PRIMARY KEY (state, code)
);

CREATE INDEX idx_councils_state ON sku.councils(state);

CREATE TABLE sku.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('QLD', 'VIC', 'NSW', 'SA', 'WA', 'NT', 'ACT', 'TAS')),
  type TEXT NOT NULL CHECK (type IN ('LGA', 'BodyCorp', 'LandInfo', 'State_government', 'Utility', 'Other')),
  display_on_ui BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  council TEXT NOT NULL DEFAULT 'ALL',
  provider_id UUID NOT NULL REFERENCES sku.providers(provider_id),
  required_data_buyer INT[] DEFAULT '{}',
  required_data_seller INT[] DEFAULT '{}',
  cost NUMERIC(10,2) NOT NULL,
  retail_price NUMERIC(10,2) NOT NULL,
  gst_option TEXT NOT NULL CHECK (gst_option IN ('no_gst', 'normal_gst_10', 'fixed_gst_percent', 'fixed_gst_amount')),
  gst_amount NUMERIC(10,2),
  fulfillment_method TEXT NOT NULL CHECK (fulfillment_method IN ('API', 'Automation', 'Manual')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_state ON sku.products(state);
CREATE INDEX idx_products_type ON sku.products(type);
CREATE INDEX idx_products_council ON sku.products(council);
CREATE INDEX idx_products_status ON sku.products(status);
CREATE INDEX idx_products_display ON sku.products(display_on_ui);

CREATE TABLE sku.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name TEXT NOT NULL,
  description TEXT,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'state', 'council')),
  scope_state TEXT CHECK (scope_state IN ('QLD', 'VIC', 'NSW', 'SA', 'WA', 'NT', 'ACT', 'TAS')),
  scope_council TEXT,
  display_on_ui BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sku.package_items (
  package_id UUID NOT NULL REFERENCES sku.packages(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES sku.products(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (package_id, product_id)
);

CREATE OR REPLACE FUNCTION sku.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER providers_updated_at BEFORE UPDATE ON sku.providers
  FOR EACH ROW EXECUTE FUNCTION sku.set_updated_at();
CREATE TRIGGER required_data_updated_at BEFORE UPDATE ON sku.required_data
  FOR EACH ROW EXECUTE FUNCTION sku.set_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON sku.products
  FOR EACH ROW EXECUTE FUNCTION sku.set_updated_at();
CREATE TRIGGER packages_updated_at BEFORE UPDATE ON sku.packages
  FOR EACH ROW EXECUTE FUNCTION sku.set_updated_at();
