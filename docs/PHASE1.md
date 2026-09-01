# Phase 1 — SKU Service & Council Reference Data

**Status: Done** (API + admin portal UI).

## What was built

| Component | Location |
|-----------|----------|
| DB schema | `supabase/sku-schema.sql` |
| Seed data | `supabase/sku-seed.sql` (4 products, 18 councils, providers, field library, 1 package) |
| RPC functions | `supabase/sku-rpc-api.sql` |
| Microservice | `services/sku/` (port **3003**) |
| Admin portal | `apps/admin-portal/` (port **5173**) |
| Gateway routes | `/v1/products`, `/v1/providers`, `/v1/required-data`, `/v1/packages`, `/v1/councils` |
| Shared types | `packages/shared-types` |

## Setup (Supabase Cloud)

Run in **SQL Editor**, in order (after Phase 0 `cloud-setup.sql` + `rpc-api.sql`):

1. `supabase/sku-schema.sql`
2. `supabase/sku-seed.sql`
3. `supabase/sku-rpc-api.sql`

Add to `.env`:

```
SKU_SERVICE_URL=http://localhost:3003
SKU_PORT=3003
ADMIN_PORT=5173
```

## Verify

```bash
pnpm db:check
pnpm dev

# API
curl "http://localhost:3000/v1/councils?state=NSW"

# Admin UI
open http://localhost:5173
```

## Admin portal features

- **Products** — list, filter, create, edit, activate/deprecate
- **Packages** — create bundles, assign products, view/edit items
- **Providers** — search-or-create when provisioning
- **Required data** — field library for buyer/seller forms
- **Councils** — read-only reference browse

> Auth is not wired yet (POC). Gateway APIs are open on localhost.

## Acceptance criteria

- [x] Product CRUD + status (draft/active/deprecated)
- [x] Provider list + create + update
- [x] Required data field library
- [x] Package CRUD + item assignment
- [x] Council reference data by state
- [x] Admin portal UI (product provisioning, package builder)
- [x] Bulk CSV import (products, providers, required data, packages)

## Next

Phase 2: catalog intelligence + order service + customer portal.
