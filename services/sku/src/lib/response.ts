import { randomUUID } from "node:crypto";
import type { ApiErrorBody, ApiResponse, RequestMeta } from "@conveyx/shared-types";

export function getRequestId(headers: Record<string, string | string[] | undefined>): string {
  const raw = headers["x-request-id"];
  if (typeof raw === "string" && raw.length > 0) return raw;
  return randomUUID();
}

export function ok<T>(data: T, requestId: string, extra?: Partial<RequestMeta>): ApiResponse<T> {
  return {
    data,
    meta: { request_id: requestId, timestamp: new Date().toISOString(), ...extra },
  };
}

export function fail(
  code: string,
  message: string,
  requestId: string,
  statusCode = 400,
  details?: ApiErrorBody["error"]["details"]
): { statusCode: number; body: ApiErrorBody } {
  return {
    statusCode,
    body: { error: { code, message, details }, meta: { request_id: requestId } },
  };
}

export function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function handleRpc<T>(
  requestId: string,
  reply: { status: (c: number) => { send: (b: unknown) => unknown } },
  fn: () => Promise<T>,
  notFoundMsg?: string
) {
  try {
    const data = await fn();
    if (data === null && notFoundMsg) {
      const err = fail("NOT_FOUND", notFoundMsg, requestId, 404);
      return reply.status(err.statusCode).send(err.body);
    }
    return ok(data as T, requestId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Database error";
    const err = fail("DB_ERROR", msg, requestId, 500);
    return reply.status(err.statusCode).send(err.body);
  }
}
