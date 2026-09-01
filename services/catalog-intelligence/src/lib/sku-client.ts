import type {
  ApiResponse,
  AuState,
  Package,
  PackageDetail,
  Product,
} from "@conveyx/shared-types";

export interface ListProductsParams {
  state?: AuState;
  type?: string;
  council?: string;
  display_on_ui?: boolean;
  status?: string;
}

export interface ListPackagesParams {
  scope_type?: string;
  scope_state?: AuState;
  scope_council?: string;
  display_on_ui?: boolean;
  status?: string;
}

export class SkuClient {
  constructor(private readonly baseUrl: string) {}

  private async fetchJson<T>(path: string, requestId?: string): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (requestId) headers["X-Request-Id"] = requestId;

    const res = await fetch(`${this.baseUrl}${path}`, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SKU service error (${res.status}): ${text}`);
    }

    const body = (await res.json()) as ApiResponse<T>;
    return body.data;
  }

  async listProducts(params: ListProductsParams, requestId?: string): Promise<Product[]> {
    const qs = new URLSearchParams();
    if (params.state) qs.set("state", params.state);
    if (params.type) qs.set("type", params.type);
    if (params.council) qs.set("council", params.council);
    if (params.display_on_ui !== undefined) qs.set("display_on_ui", String(params.display_on_ui));
    if (params.status) qs.set("status", params.status);

    const all: Product[] = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    while (all.length < total) {
      qs.set("page", String(page));
      qs.set("page_size", "200");
      const res = await fetch(`${this.baseUrl}/v1/products?${qs.toString()}`, {
        headers: requestId ? { Accept: "application/json", "X-Request-Id": requestId } : { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`SKU service error (${res.status}): ${await res.text()}`);
      }
      const body = (await res.json()) as ApiResponse<Product[]>;
      const items = body.data ?? [];
      total = body.meta?.total ?? items.length;
      all.push(...items);
      if (items.length === 0) break;
      page += 1;
    }
    return all;
  }

  async listPackages(params: ListPackagesParams, requestId?: string): Promise<Package[]> {
    const qs = new URLSearchParams();
    if (params.scope_type) qs.set("scope_type", params.scope_type);
    if (params.scope_state) qs.set("scope_state", params.scope_state);
    if (params.scope_council) qs.set("scope_council", params.scope_council);
    if (params.display_on_ui !== undefined) qs.set("display_on_ui", String(params.display_on_ui));
    if (params.status) qs.set("status", params.status);

    const query = qs.toString();
    return this.fetchJson<Package[]>(`/v1/packages${query ? `?${query}` : ""}`, requestId);
  }

  async getPackage(packageId: string, requestId?: string): Promise<PackageDetail> {
    return this.fetchJson<PackageDetail>(`/v1/packages/${packageId}`, requestId);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
