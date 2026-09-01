# Phase 0 — Implementation Guide

**Goal:** Turborepo + pnpm monorepo, Supabase (Postgres schemas + Storage), API gateway, identity-service, customer-service.

**Status:** Complete — run Supabase locally to activate DB-backed endpoints.

---

## 0. Prerequisites

```bash
node -v    # >= 20
pnpm -v    # >= 9
supabase -v  # Supabase CLI
docker -v  # for Redis/NATS (optional in Phase 0)
```

---

## 1. Repository Structure

```
conveyX/
├── apps/
│   └── api-gateway/          # :3000
├── services/
│   ├── identity/             # :3001
│   └── customer/             # :3002
├── packages/
│   ├── shared-types/
│   └── events/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 202608290001_schema_customer.sql
│   │   ├── 202608290002_schema_identity.sql
│   │   └── 202608290003_storage_buckets.sql
│   └── seed.sql
├── infra/
│   └── docker-compose.yml    # Redis + NATS (optional Phase 0)
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example
└── README.md
```

---

## 2. Root Config Files

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "services/*"
  - "packages/*"
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

### Root `package.json`

```json
{
  "name": "conveyx",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:status": "supabase status"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=20" }
}
```

---

## 3. Supabase Migrations

### `202608290001_schema_customer.sql`

```sql
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
```

### `202608290002_schema_identity.sql`

```sql
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
```

### `202608290003_storage_buckets.sql`

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('fulfillment-docs', 'fulfillment-docs', false, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('contracts', 'contracts', false, 52428800, ARRAY['application/pdf']),
  ('signed-docs', 'signed-docs', false, 52428800, ARRAY['application/pdf']),
  ('invoices', 'invoices', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
```

### `seed.sql`

```sql
-- Demo master entity
INSERT INTO customer.entities (id, name, entity_type, abn)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Conveyancing Firm', 'master', '12345678901')
ON CONFLICT DO NOTHING;

INSERT INTO customer.entity_settings (entity_id, billing_preference, billing_cycle, invoice_email)
VALUES ('11111111-1111-1111-1111-111111111111', 'invoice', 'monthly', 'accounts@demo.conveyx.local')
ON CONFLICT DO NOTHING;

-- Demo admin user profile (link to Supabase auth.users after signup)
INSERT INTO identity.user_profiles (id, entity_id, email, first_name, last_name)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'admin@demo.conveyx.local',
  'Demo',
  'Admin'
) ON CONFLICT DO NOTHING;

INSERT INTO identity.role_assignments (user_id, entity_id, role)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'entity_admin')
ON CONFLICT DO NOTHING;

INSERT INTO identity.teams (id, entity_id, name, description)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Conveyancing', 'Default team')
ON CONFLICT DO NOTHING;
```

---

## 4. Shared Packages

### `packages/shared-types`

Exports: `Entity`, `EntitySettings`, `UserProfile`, `Team`, `ApiResponse`, `PaginatedResponse`, enums for `EntityType`, `BillingPreference`, `Role`.

### `packages/events`

Exports: CloudEvents envelope type + `ENTITY_CREATED`, `USER_CREATED` event constants (used in Phase 1+).

---

## 5. Service Implementation Summary

### identity-service (:3001)

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness |
| `GET /health/ready` | Postgres check |
| `GET /users/me` | Current user profile + roles + teams |
| `GET /users` | List users in entity |
| `POST /users` | Create user profile |
| `GET /teams` | List teams |
| `POST /teams` | Create team |
| `POST /teams/:id/members` | Add member |

**Stack:** Fastify, `@supabase/supabase-js`, `@conveyx/shared-types`

### customer-service (:3002)

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness |
| `GET /health/ready` | Postgres check |
| `GET /entities` | List entities |
| `POST /entities` | Create master/branch |
| `GET /entities/:id` | Get entity |
| `PATCH /entities/:id` | Update entity |
| `GET /entities/:id/settings` | Get settings |
| `PATCH /entities/:id/settings` | Update billing prefs |
| `GET /entities/:id/branches` | List branches |

**Stack:** Fastify, `@supabase/supabase-js`, `@conveyx/shared-types`

### api-gateway (:3000)

| Route prefix | Proxy target |
|--------------|--------------|
| `/v1/users/*`, `/v1/teams/*`, `/v1/auth/*` | identity-service:3001 |
| `/v1/entities/*` | customer-service:3002 |
| `/health` | gateway health |
| `/v1/openapi.json` | stub aggregated spec |

**Stack:** Fastify, `@fastify/http-proxy`, JWT validation via Supabase JWT secret

---

## 6. Environment Variables

### `.env.example`

```bash
# Supabase (from `supabase status`)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

# Services
GATEWAY_PORT=3000
IDENTITY_SERVICE_URL=http://localhost:3001
CUSTOMER_SERVICE_URL=http://localhost:3002
IDENTITY_PORT=3001
CUSTOMER_PORT=3002

# Optional Phase 0
REDIS_URL=redis://localhost:6379
NATS_URL=nats://localhost:4222
```

---

## 7. Docker Compose (optional Phase 0)

```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  nats:
    image: nats:2-alpine
    ports: ["4222:4222", "8222:8222"]
    command: ["-js", "-m", "8222"]
```

---

## 8. Startup Commands

```bash
# 1. Install dependencies
pnpm install

# 2. Start Supabase
pnpm db:start
pnpm db:reset    # runs migrations + seed

# 3. Copy env
cp .env.example .env
# Fill keys from `supabase status`

# 4. Start all services
pnpm dev
```

**Verify:**

```bash
curl http://localhost:3000/health
curl http://localhost:3000/v1/entities
curl http://localhost:3001/health
curl http://localhost:3002/health
```

---

## 9. Phase 0 Acceptance Criteria

- [ ] Monorepo builds with `pnpm build`
- [ ] `supabase db reset` creates `customer` + `identity` schemas
- [ ] Storage buckets created (`fulfillment-docs`, `contracts`, `signed-docs`, `invoices`)
- [ ] Gateway proxies `/v1/entities` → customer-service
- [ ] Gateway proxies `/v1/users`, `/v1/teams` → identity-service
- [ ] Seed data: demo entity + admin user profile
- [ ] Health endpoints return 200 on all three apps

---

## 10. Next Step

**Switch to Agent mode** and say *"execute Phase 0"* — the agent will scaffold all files above automatically.
