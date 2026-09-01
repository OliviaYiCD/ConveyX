import type { GstOption, Product } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";

export function calcGst(retailPrice: number, gstOption: GstOption, gstAmount: number | null): number {
  if (gstOption === "no_gst") return 0;
  if (gstOption === "normal_gst_10") return Math.round(retailPrice * 0.1 * 100) / 100;
  if (gstOption === "fixed_gst_amount") return gstAmount ?? 0;
  if (gstOption === "fixed_gst_percent" && gstAmount) {
    return Math.round(retailPrice * (gstAmount / 100) * 100) / 100;
  }
  return 0;
}

export async function fetchProduct(productId: string): Promise<Product | null> {
  return rpc<Product | null>("cx_get_product", { p_id: productId });
}

export async function buildLineFromProduct(
  product: Product,
  quantity: number,
  requiredBuyer: Record<string, unknown>,
  requiredSeller: Record<string, unknown>,
  sortOrder: number
) {
  const unitPrice = Number(product.retail_price);
  const gstAmount = calcGst(unitPrice, product.gst_option, product.gst_amount !== null ? Number(product.gst_amount) : null);
  const lineTotal = unitPrice * quantity + gstAmount * quantity;

  return {
    product_id: product.id,
    product_name: product.product_name,
    sku: product.sku,
    product_type: product.type,
    quantity,
    unit_price: unitPrice,
    gst_amount: gstAmount * quantity,
    line_total: lineTotal,
    required_data_buyer: requiredBuyer,
    required_data_seller: requiredSeller,
    sort_order: sortOrder,
  };
}
