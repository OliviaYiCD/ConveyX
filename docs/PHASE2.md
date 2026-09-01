# Phase 2 — Customer Portal, Orders & Billing (POC)

**Status:** Done (no payment gateway — invoice billing only).

## Setup (Supabase SQL Editor)

**Easiest — one file:**

Run **`supabase/phase2-setup.sql`** (entire file) in SQL Editor.

**Or step by step:**

1. `supabase/order-schema.sql`
2. `supabase/billing-schema.sql`
3. `supabase/order-billing-rpc-api.sql`

Optional: `supabase/sku-seed-customer-demo.sql`

## Run

```bash
pnpm dev
```

| App | URL |
|-----|-----|
| Customer portal | http://localhost:5174 |
| Admin portal | http://localhost:5173 → **Invoices** |
| API gateway | http://localhost:3000 |

## Customer journey

1. Enter address (+ optional body corporate checkbox)
2. Review products grouped by type (LGA, LandInfo, State, BodyCorp, Utility, Other)
3. Select products → Review order → **Place order** (no payment)
4. Order creates a **pending transaction**

## Admin journey

1. **Admin → Invoices**
2. View pending transactions from customer orders
3. **Generate invoice** → creates invoice + marks transactions as invoiced

## Product matching rules (address search)

| Type | Rule |
|------|------|
| LGA | Suburb/council match |
| State_government | State-wide (`council = ALL`) |
| BodyCorp | Only if body corp checked or strata detected |
| Utility | Suburb/council match |
| LandInfo | State-wide |
| Other | State match |

## Services added

- `services/order` — :3007
- `services/billing` — :3009
- `apps/customer-portal` — :5174
