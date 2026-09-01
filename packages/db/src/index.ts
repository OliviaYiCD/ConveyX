import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import ws from "ws";

let pool: pg.Pool | null = null;
let supabase: SupabaseClient | null = null;

export type DbMode = "postgres" | "rpc";

export function getDbMode(): DbMode {
  if (process.env.DATABASE_URL) return "postgres";
  return "rpc";
}

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (or set DATABASE_URL)");
    }
    // Node < 22 has no native WebSocket; Supabase client requires one for RPC.
    if (typeof globalThis.WebSocket === "undefined") {
      globalThis.WebSocket = ws as unknown as typeof WebSocket;
    }
    supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return supabase;
}

function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for postgres mode");
    }
    pool = new pg.Pool({
      connectionString,
      ssl: connectionString.includes("supabase") ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  }
  return pool;
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  if (getDbMode() === "rpc") {
    throw new Error("Direct SQL not available in RPC mode");
  }
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function checkDbHealth(): Promise<boolean> {
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await rpc("cx_health_check");
      return true;
    }
    if (process.env.DATABASE_URL) {
      await query("SELECT 1 AS ok");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
