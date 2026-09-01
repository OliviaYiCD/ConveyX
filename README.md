# ConveyX

Australian conveyancing due diligence platform — API-first microservices POC.

## Docs

- [PRD](./docs/PRD.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [API outline](./docs/API.md)
- [Phase 0 guide](./docs/PHASE0.md)
- [Phase 1 guide](./docs/PHASE1.md)
- [Supabase Cloud setup](./docs/SUPABASE-CLOUD.md) — **use this if you don't have Docker**

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- **Database (pick one):**
  - **Option A — Supabase Cloud** (no Docker) → see [docs/SUPABASE-CLOUD.md](./docs/SUPABASE-CLOUD.md)
  - **Option B — Local Supabase** → Supabase CLI + Docker Desktop

## Quick start (Supabase Cloud — recommended without Docker)

```bash
pnpm install

# 1. Create a free project at https://supabase.com/dashboard
# 2. Run supabase/cloud-setup.sql in Dashboard → SQL Editor
# 3. Run supabase/rpc-api.sql in SQL Editor
# 4. Run supabase/sku-schema.sql → sku-seed.sql → sku-rpc-api.sql (Phase 1)
# 5. Copy Project URL + service_role key into .env

cp .env.example .env
pnpm dev
```

## Quick start (local Supabase — requires Docker)

```bash
pnpm install
pnpm db:start    # needs Docker Desktop running
pnpm db:reset

cp .env.example .env
# Fill SUPABASE_* keys from: pnpm db:status

pnpm dev
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| api-gateway | 3000 | Routes `/v1/*` to backend services |
| identity-service | 3001 | Users, teams, roles |
| customer-service | 3002 | Entities, billing settings |
| sku-service | 3003 | Products, providers, packages, councils |
| catalog-intelligence-service | 3004 | Property resolution + SKU/package recommendations |
| **admin-portal** | **5173** | **SKU provisioning UI (React)** |

Open **http://localhost:5173** after `pnpm dev` to manage products, providers, packages, and required-data fields.

## Verify

```bash
pnpm db:check   # expects 4 products, 18 councils after Phase 1 SQL

curl http://localhost:3000/health
curl http://localhost:3000/v1/entities
curl http://localhost:3000/v1/users/me
curl "http://localhost:3000/v1/councils?state=NSW"
curl "http://localhost:3000/v1/products?state=NSW"
curl http://localhost:3000/v1/packages
curl -X POST http://localhost:3000/v1/intelligence/resolve \
  -H "Content-Type: application/json" \
  -d '{"identifier_type":"address","value":"1 George St, Sydney NSW 2000"}'
curl -X POST http://localhost:3000/v1/intelligence/recommend \
  -H "Content-Type: application/json" \
  -d '{"identifier_type":"address","value":"1 George St, Sydney NSW 2000"}'
```

## Monorepo structure

```
apps/api-gateway          # API gateway
apps/admin-portal         # Admin UI for SKU management (Phase 1)
services/identity         # Identity service
services/customer         # Customer service
services/sku              # SKU / catalog service (Phase 1)
services/catalog-intelligence  # Property resolution + recommendations (Phase 2)
packages/shared-types     # Shared TypeScript types
packages/events           # CloudEvents types
supabase/                 # Migrations + seed + cloud-setup.sql + sku-*.sql
infra/                    # Docker Compose (Redis, NATS)
```

## Database

Schemas: `customer` (entities), `identity` (users, teams, roles), `sku` (products, providers, packages, councils)

Storage buckets: `fulfillment-docs`, `contracts`, `signed-docs`, `invoices`

## Optional infrastructure (requires Docker)

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in dev mode |
| `pnpm build` | Build all packages |
| `pnpm db:start` | Start **local** Supabase (Docker required) |
| `pnpm db:reset` | Reset local DB + migrations + seed |
| `pnpm db:push` | Push migrations to linked cloud project |
