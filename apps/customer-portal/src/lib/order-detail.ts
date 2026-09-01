import type { OrderDetail } from "@conveyx/shared-types";

export function normalizeOrderDetail(raw: unknown): OrderDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  if (data.order && typeof data.order === "object") {
    return {
      order: data.order as OrderDetail["order"],
      lines: Array.isArray(data.lines) ? (data.lines as OrderDetail["lines"]) : [],
    };
  }

  if (typeof data.id === "string" && typeof data.property_address === "string") {
    return {
      order: data as unknown as OrderDetail["order"],
      lines: Array.isArray(data.lines) ? (data.lines as OrderDetail["lines"]) : [],
    };
  }

  return null;
}

export function orderReference(orderId: string): string {
  return `ORD-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
