import type { CreateProductInput, Product } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";

export function productToRpcData(body: CreateProductInput): Record<string, unknown> {
  return {
    product_name: body.product_name,
    sku: body.sku,
    state: body.state,
    type: body.type,
    display_on_ui: body.display_on_ui ?? true,
    description: body.description ?? null,
    council: body.council ?? "ALL",
    provider_id: body.provider_id,
    required_data_buyer: body.required_data_buyer ?? [],
    required_data_seller: body.required_data_seller ?? [],
    cost: body.cost ?? 0,
    retail_price: body.retail_price ?? 0,
    gst_option: body.gst_option ?? "normal_gst_10",
    gst_amount: body.gst_amount ?? null,
    fulfillment_method: body.fulfillment_method ?? "Manual",
    status: body.status ?? "draft",
  };
}

export async function createProduct(body: CreateProductInput): Promise<Product> {
  return rpc<Product>("cx_create_product", { p_data: productToRpcData(body) });
}

export function validateProductInput(body: CreateProductInput): string | null {
  if (!body.product_name || !body.sku || !body.state || !body.type || !body.provider_id) {
    return "product_name, sku, state, type, and provider_id are required";
  }
  return null;
}
