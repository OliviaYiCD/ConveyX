import type { ApiErrorBody, ApiResponse, RequestMeta } from "@conveyx/shared-types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export interface ListResult<T> {
  items: T[];
  meta: RequestMeta;
}

async function requestRaw<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body != null && init.body !== "";

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const json = (await res.json()) as ApiResponse<T> | ApiErrorBody | { message?: string; error?: string };

  if (!res.ok) {
    const err = json as ApiErrorBody & { message?: string };
    throw new Error(
      err.error?.message ?? err.message ?? `Request failed (${res.status})`
    );
  }

  return json as ApiResponse<T>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const json = await requestRaw<T>(path, init);
  return json.data;
}

/** Fetch every page of a paginated list endpoint (e.g. providers). */
export async function fetchAllPages<T>(
  path: string,
  pageSize = 200
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (all.length < total) {
    const sep = path.includes("?") ? "&" : "?";
    const json = await requestRaw<T[]>(
      `${path}${sep}page=${page}&page_size=${pageSize}`
    );
    const items = json.data ?? [];
    total = json.meta?.total ?? items.length;
    all.push(...items);
    if (items.length === 0) break;
    page += 1;
  }

  return all;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getList: async <T>(path: string): Promise<ListResult<T>> => {
    const json = await requestRaw<T[]>(path);
    return { items: json.data, meta: json.meta };
  },
  fetchAllPages,
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
