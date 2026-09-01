import type { ApiErrorBody, ApiResponse } from "@conveyx/shared-types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body != null && init.body !== "";
  if (hasBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const json = (await res.json()) as ApiResponse<T> | ApiErrorBody | { message?: string };

  if (!res.ok) {
    const err = json as ApiErrorBody & { message?: string };
    throw new Error(err.error?.message ?? err.message ?? `Request failed (${res.status})`);
  }
  return (json as ApiResponse<T>).data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};

export const DEMO_ENTITY_ID =
  import.meta.env.VITE_DEMO_ENTITY_ID ?? "11111111-1111-1111-1111-111111111111";

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}
