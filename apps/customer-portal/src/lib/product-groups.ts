import type { ProductType, RecommendedProduct } from "@conveyx/shared-types";

const GROUP_ORDER: ProductType[] = [
  "LGA",
  "LandInfo",
  "State_government",
  "BodyCorp",
  "Utility",
  "Other",
];

const GROUP_LABELS: Record<ProductType, string> = {
  LGA: "LGA (Council)",
  LandInfo: "LandInfo",
  State_government: "State",
  BodyCorp: "Body Corporate",
  Utility: "Utility",
  Other: "Other",
};

export function groupProducts(products: RecommendedProduct[]) {
  const map = new Map<ProductType, RecommendedProduct[]>();
  for (const p of products) {
    const type = p.product.type;
    if (!map.has(type)) map.set(type, []);
    map.get(type)!.push(p);
  }
  return GROUP_ORDER.filter((t) => map.has(t)).map((type) => ({
    type,
    label: GROUP_LABELS[type],
    items: map.get(type)!,
  }));
}
