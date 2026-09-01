# Deploy backend + connect Vercel

ConveyX is split into:

| Layer | Host | Example |
|-------|------|---------|
| Admin / customer UI | **Vercel** | `https://convey-x-admin-portal.vercel.app` |
| API gateway + services | **Render** (recommended) | `https://conveyx-gateway.onrender.com` |
| Database | **Supabase Cloud** | already set up |

The admin portal only needs **`VITE_API_URL`** pointing at the public gateway URL.

---

## Part 1 — Deploy backend on Render (~10 min)

### 1. Push latest code

Ensure GitHub has the latest `main` branch (includes `render.yaml`).

### 2. Create Render account

Sign up at [render.com](https://render.com) and connect GitHub.

### 3. Deploy with Blueprint

1. **New** → **Blueprint**
2. Select repo **OliviaYiCD/ConveyX**
3. Render reads `render.yaml` and creates 7 services:
   - `conveyx-sku`, `conveyx-identity`, `conveyx-customer`, `conveyx-order`, `conveyx-billing`, `conveyx-catalog-intelligence`, `conveyx-gateway`
4. When prompted for the **conveyx-supabase** variable group, enter values from your local `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Apply** and wait for all services to deploy (first build ~5–10 min each on free tier).

### 4. Copy the gateway URL

Open the **conveyx-gateway** service → copy its public URL, e.g.:

```text
https://conveyx-gateway.onrender.com
```

Test in a browser:

```text
https://conveyx-gateway.onrender.com/health
```

You should see JSON with `"status": "ok"`.

> **Free tier note:** Render spins down idle services. The first request after idle may take 30–60 seconds (cold start).

---

## Part 2 — Connect Vercel admin portal

### 1. Vercel project settings

| Setting | Value |
|---------|--------|
| Root Directory | `apps/admin-portal` |
| Framework | Vite (auto from `vercel.json`) |

### 2. Environment variables (Production)

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://conveyx-gateway.onrender.com` (your gateway URL, no trailing slash) |

**Remove** from Vercel (not used by the frontend):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`

### 3. Redeploy

Deployments → **Redeploy** so `VITE_API_URL` is baked into the build.

### 4. Verify

Open the admin portal → **Products** or **Providers**. Data should load from Supabase via the gateway.

---

## Part 3 — Customer portal (optional)

Create a second Vercel project:

| Setting | Value |
|---------|--------|
| Root Directory | `apps/customer-portal` |
| `VITE_API_URL` | same gateway URL |
| `VITE_DEMO_ENTITY_ID` | `11111111-1111-1111-1111-111111111111` (optional) |

---

## Troubleshooting

### Admin portal shows empty / network errors

1. Check `https://YOUR-GATEWAY/health` returns OK.
2. Confirm `VITE_API_URL` has `https://` and **no** trailing slash.
3. Redeploy Vercel after changing env vars (Vite embeds them at build time).

### Gateway returns 502 from a route

One upstream service is down. In Render, open each service → **Logs**. Common fix: redeploy the failing service.

### SKU / DB errors

Confirm Supabase vars on Render match your project. Run SQL migrations in Supabase if tables/RPCs are missing (see `docs/SUPABASE-CLOUD.md`).

### CORS

The gateway enables `origin: true` (all origins). No extra CORS config needed for Vercel.

---

## What runs where

```text
Browser (Vercel admin UI)
    → VITE_API_URL /v1/*
        → conveyx-gateway (Render)
            → conveyx-sku / identity / order / … (Render)
                → Supabase (RPC)
```

---

## Quick local reference

| Variable | Local | Production (Render gateway) |
|----------|-------|----------------------------|
| `VITE_API_URL` | empty (Vite proxy) | `https://conveyx-gateway.onrender.com` |
| `SUPABASE_*` | `.env` on laptop | Render env group `conveyx-supabase` |
