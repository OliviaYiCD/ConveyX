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

export type SupabaseEnvDiagnostics = {
  supabase_url_set: boolean;
  supabase_key_set: boolean;
  supabase_url_host: string | null;
  key_length: number;
  key_role: string | null;
  key_project_ref: string | null;
  refs_match: boolean | null;
};

function parseSupabaseKey(key: string): { role: string | null; ref: string | null } {
  try {
    const payloadPart = key.split(".")[1];
    if (!payloadPart) return { role: null, ref: null };
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString()) as {
      role?: string;
      ref?: string;
    };
    return { role: payload.role ?? null, ref: payload.ref ?? null };
  } catch {
    return { role: null, ref: null };
  }
}

export function getSupabaseEnvDiagnostics(): SupabaseEnvDiagnostics {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const urlRef = url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;
  const { role, ref } = key ? parseSupabaseKey(key) : { role: null, ref: null };

  return {
    supabase_url_set: Boolean(url),
    supabase_key_set: Boolean(key),
    supabase_url_host: urlRef ? `${urlRef}.supabase.co` : url ? "(non-standard url)" : null,
    key_length: key.length,
    key_role: role,
    key_project_ref: ref,
    refs_match: urlRef && ref ? urlRef === ref : null,
  };
}

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (or set DATABASE_URL)");
    }

    const { role, ref } = parseSupabaseKey(key);
    if (role && role !== "service_role") {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY has role "${role}" — paste the service_role secret from Supabase Dashboard → Project Settings → API`
      );
    }

    const urlRef = url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;
    if (urlRef && ref && urlRef !== ref) {
      throw new Error(
        `SUPABASE_URL project (${urlRef}) does not match key project (${ref})`
      );
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
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (url && key) {
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
