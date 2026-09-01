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
