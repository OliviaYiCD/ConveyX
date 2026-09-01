#!/usr/bin/env node
import { execSync } from "node:child_process";

try {
  execSync("docker info", { stdio: "ignore" });
} catch {
  console.error(`
❌ Docker is not running (required for local Supabase).

You're using Supabase Cloud — skip db:start entirely:

  1. Run supabase/cloud-setup.sql in Dashboard → SQL Editor
  2. Settings → API → Exposed schemas → add: customer, identity
  3. Fill .env with cloud keys (not localhost)
  4. pnpm db:check
  5. pnpm dev

Guide: docs/SUPABASE-CLOUD.md
`);
  process.exit(1);
}

execSync("supabase start", { stdio: "inherit" });
