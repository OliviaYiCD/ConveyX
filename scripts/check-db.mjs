#!/usr/bin/env node
/**
 * Verify Supabase connection (RPC mode — no DATABASE_URL needed).
 * Usage: pnpm db:check
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

if (!existsSync(envPath)) {
  console.error("\n❌ Missing .env — run: cp .env.example .env\n");
  process.exit(1);
}

for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("\n❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env\n");
  process.exit(1);
}

console.log("\n🔍 Checking Supabase (RPC mode)...");

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb.rpc("cx_health_check");

if (error?.message?.includes("Could not find the function")) {
  console.error("\n❌ RPC functions not installed");
  console.error("\n   Run supabase/rpc-api.sql in Supabase Dashboard → SQL Editor");
  console.error("   (After cloud-setup.sql)\n");
  process.exit(1);
}

if (error) {
  console.error("\n❌", error.message, "\n");
  process.exit(1);
}

const count = data?.entity_count ?? 0;
const products = data?.product_count;
const councils = data?.council_count;

let summary = `✅ Database OK — ${count} entit${count === 1 ? "y" : "ies"} in seed data`;
if (products !== undefined) {
  summary += `, ${products} product${products === 1 ? "" : "s"}, ${councils ?? 0} council${councils === 1 ? "" : "s"}`;
}
console.log(summary);
if (count === 0) console.log("   Tip: re-run the seed section of cloud-setup.sql");
if (products === undefined) {
  console.log("   Tip: run supabase/sku-schema.sql, sku-seed.sql, sku-rpc-api.sql for Phase 1 SKU data");
}
console.log("\n   Next: pnpm dev\n");

// Optional: warn if DATABASE_URL is set but pooler often fails
if (process.env.DATABASE_URL) {
  console.log("ℹ️  DATABASE_URL is set but not used (RPC mode). You can remove it from .env.\n");
}
