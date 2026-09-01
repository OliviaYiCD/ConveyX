-- ConveyX cloud setup (run once in Supabase Dashboard → SQL Editor)
-- Use this if you don't have Docker for local `supabase start`

-- 1. Customer schema
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

-- 2. Identity schema
CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE identity.user_profiles (
  id UUID PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES customer.entities(id),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_entity ON identity.user_profiles(entity_id);
CREATE UNIQUE INDEX idx_user_profiles_email ON identity.user_profiles(email);

CREATE TABLE identity.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES customer.entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teams_entity ON identity.teams(entity_id);

CREATE TABLE identity.team_memberships (
  team_id UUID NOT NULL REFERENCES identity.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE identity.role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES identity.user_profiles(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES customer.entities(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'entity_admin', 'entity_billing', 'entity_user',
    'conveyx_admin', 'conveyx_ops'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role, entity_id)
);

CREATE TABLE identity.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION identity.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON identity.user_profiles
  FOR EACH ROW EXECUTE FUNCTION identity.set_updated_at();

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON identity.teams
  FOR EACH ROW EXECUTE FUNCTION identity.set_updated_at();

GRANT USAGE ON SCHEMA identity TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA identity TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA identity TO anon, authenticated;

-- 3. Storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('fulfillment-docs', 'fulfillment-docs', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('contracts', 'contracts', false, 52428800, ARRAY['application/pdf']),
  ('signed-docs', 'signed-docs', false, 52428800, ARRAY['application/pdf']),
  ('invoices', 'invoices', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 4. Seed data
INSERT INTO customer.entities (id, name, entity_type, abn)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Conveyancing Firm', 'master', '12345678901')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer.entity_settings (entity_id, billing_preference, billing_cycle, invoice_email)
VALUES ('11111111-1111-1111-1111-111111111111', 'invoice', 'monthly', 'accounts@demo.conveyx.local')
ON CONFLICT (entity_id) DO NOTHING;

INSERT INTO identity.user_profiles (id, entity_id, email, first_name, last_name)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'admin@demo.conveyx.local',
  'Demo',
  'Admin'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.role_assignments (user_id, entity_id, role)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'entity_admin')
ON CONFLICT (user_id, role, entity_id) DO NOTHING;

INSERT INTO identity.teams (id, entity_id, name, description)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Conveyancing', 'Default team')
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.team_memberships (team_id, user_id)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (team_id, user_id) DO NOTHING;

-- 5. Expose schemas to PostgREST API (Settings → API → Exposed schemas in dashboard)
-- Add: customer, identity
