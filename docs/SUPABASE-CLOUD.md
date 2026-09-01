# Supabase Cloud Setup (No Docker)

Use this when `pnpm db:start` fails with **docker: command not found**. Supabase Cloud gives you Postgres, Auth, and Storage without running Docker locally.

---

## Step 1 — Create a Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → pick org, name (`conveyx-poc`), password, region (e.g. Sydney)
3. Wait for the project to finish provisioning (~2 min)

---

## Step 2 — Run database setup SQL

1. Open your project → **SQL Editor** → **New query**
2. Copy the entire contents of [`supabase/cloud-setup.sql`](../supabase/cloud-setup.sql)
3. Click **Run**

You should see schemas `customer` and `identity` created with seed data (Demo Conveyancing Firm).

---

## Step 3 — Expose schemas (optional)

Backend services use **direct Postgres** (`DATABASE_URL`), so exposing schemas is **not required** for Phase 0.

If you use Supabase client libraries from the browser later, add `customer` and `identity` under **Settings → API → Exposed schemas**.

---

## Step 4 — Configure `.env`

1. **Project Settings** → **Database** → **Connection string** → **URI**
2. Choose **Session pooler** (port 6543)
3. Copy the URI and replace `[YOUR-PASSWORD]` with your database password
4. Add to `.env` as `DATABASE_URL`

Also copy API keys from **Settings** → **API**:

```bash
cp .env.example .env
```

```bash
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
DATABASE_URL=postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
```

> **Note:** Backend services connect via `DATABASE_URL` (direct Postgres). You do **not** need to expose `customer` / `identity` schemas in API settings.

---

## Step 5 — Start services

```bash
pnpm dev
```

Verify:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/v1/entities
curl http://localhost:3000/v1/users/me
curl http://localhost:3002/health/ready
```

`/health/ready` should return `"ready"` once Supabase is reachable.

---

## Optional — CLI push (instead of SQL Editor)

If you have Supabase CLI but **not** Docker:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
pnpm db:push
```

Project ref is in Dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`.

---

## Optional — Install Docker later for local dev

If you want local Supabase later:

1. Install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/)
2. Start Docker Desktop
3. Run `pnpm db:start` and `pnpm db:reset`

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `docker: command not found` | Use this cloud guide; don't use `pnpm db:start` |
| `The schema must be one of...` | Add `customer`, `identity` to Exposed schemas in API settings |
| `Invalid API key` | Use **service_role** key in `SUPABASE_SERVICE_ROLE_KEY` |
| `Database unavailable` on `/health/ready` | Check URL/key; confirm SQL ran successfully |
| Empty `/v1/entities` | Re-run seed section of `cloud-setup.sql` |
