import type { Product, RequiredDataField } from "@conveyx/shared-types";

export type LineRequiredData = {
  buyer: Record<string, string>;
  seller: Record<string, string>;
};

export type CartRequiredData = Record<string, LineRequiredData>;

export function fieldMap(fields: RequiredDataField[]): Map<number, RequiredDataField> {
  return new Map(fields.map((f) => [f.field_id, f]));
}

export function productRequiredFields(
  product: Product,
  fields: RequiredDataField[]
): { buyer: RequiredDataField[]; seller: RequiredDataField[] } {
  const byId = fieldMap(fields);
  return {
    buyer: product.required_data_buyer.map((id) => byId.get(id)).filter((f): f is RequiredDataField => !!f),
    seller: product.required_data_seller.map((id) => byId.get(id)).filter((f): f is RequiredDataField => !!f),
  };
}

export function cartNeedsRequiredData(products: Product[], fields: RequiredDataField[]): boolean {
  return products.some((p) => {
    const { buyer, seller } = productRequiredFields(p, fields);
    return buyer.length > 0 || seller.length > 0;
  });
}

export function isAddressField(field: RequiredDataField): boolean {
  const key = field.field_key.toLowerCase();
  const name = field.field_name.toLowerCase();
  return (
    key.includes("address") ||
    name.includes("address") ||
    key.includes("property_address") ||
    name.includes("property address")
  );
}

function defaultFieldValue(field: RequiredDataField, propertyAddress?: string): string {
  if (propertyAddress && isAddressField(field)) {
    return propertyAddress;
  }
  return "";
}

/** Unique required fields across all cart products for one side (buyer/seller). */
export function uniqueCartRequiredFields(
  products: Product[],
  fields: RequiredDataField[],
  side: "buyer" | "seller"
): RequiredDataField[] {
  const seen = new Set<string>();
  const result: RequiredDataField[] = [];

  for (const product of products) {
    const { buyer, seller } = productRequiredFields(product, fields);
    const list = side === "buyer" ? buyer : seller;
    for (const field of list) {
      if (!seen.has(field.field_key)) {
        seen.add(field.field_key);
        result.push(field);
      }
    }
  }

  return result;
}

export function getSharedFieldValue(
  products: Product[],
  fields: RequiredDataField[],
  values: CartRequiredData,
  side: "buyer" | "seller",
  fieldKey: string
): string {
  for (const product of products) {
    const { buyer, seller } = productRequiredFields(product, fields);
    const list = side === "buyer" ? buyer : seller;
    if (list.some((f) => f.field_key === fieldKey)) {
      return values[product.id]?.[side][fieldKey] ?? "";
    }
  }
  return "";
}

/** Write a shared field value to every product line that requires it. */
export function applySharedFieldUpdate(
  products: Product[],
  fields: RequiredDataField[],
  current: CartRequiredData,
  side: "buyer" | "seller",
  fieldKey: string,
  value: string
): CartRequiredData {
  const next: CartRequiredData = { ...current };

  for (const product of products) {
    const { buyer, seller } = productRequiredFields(product, fields);
    const list = side === "buyer" ? buyer : seller;
    if (!list.some((f) => f.field_key === fieldKey)) continue;

    const line = next[product.id] ?? { buyer: {}, seller: {} };
    next[product.id] = {
      ...line,
      [side]: { ...line[side], [fieldKey]: value },
    };
  }

  return next;
}

export function emptyCartRequiredData(
  products: Product[],
  fields: RequiredDataField[],
  propertyAddress?: string
): CartRequiredData {
  const data: CartRequiredData = {};
  for (const product of products) {
    const { buyer, seller } = productRequiredFields(product, fields);
    if (buyer.length === 0 && seller.length === 0) continue;
    data[product.id] = {
      buyer: Object.fromEntries(
        buyer.map((f) => [f.field_key, defaultFieldValue(f, propertyAddress)])
      ),
      seller: Object.fromEntries(
        seller.map((f) => [f.field_key, defaultFieldValue(f, propertyAddress)])
      ),
    };
  }
  return data;
}

/** Merge existing values, sync overlaps, and prefill address when empty. */
export function normalizeCartRequiredData(
  products: Product[],
  fields: RequiredDataField[],
  data: CartRequiredData,
  propertyAddress?: string
): CartRequiredData {
  let next = emptyCartRequiredData(products, fields, propertyAddress);

  for (const product of products) {
    const existing = data[product.id];
    if (!existing) continue;
    next[product.id] = {
      buyer: { ...next[product.id]!.buyer, ...existing.buyer },
      seller: { ...next[product.id]!.seller, ...existing.seller },
    };
  }

  for (const side of ["buyer", "seller"] as const) {
    for (const field of uniqueCartRequiredFields(products, fields, side)) {
      let value = getSharedFieldValue(products, fields, next, side, field.field_key).trim();
      if (!value && propertyAddress && isAddressField(field)) {
        value = propertyAddress;
      }
      if (value) {
        next = applySharedFieldUpdate(products, fields, next, side, field.field_key, value);
      }
    }
  }

  return next;
}

export function validateCartRequiredData(
  products: Product[],
  fields: RequiredDataField[],
  values: CartRequiredData
): string | null {
  for (const product of products) {
    const { buyer, seller } = productRequiredFields(product, fields);
    const line = values[product.id];
    if (!line) {
      if (buyer.length || seller.length) return `Missing required information for ${product.product_name}`;
      continue;
    }
    for (const f of buyer) {
      if (!line.buyer[f.field_key]?.trim()) return `${f.field_name} is required`;
    }
    for (const f of seller) {
      if (!line.seller[f.field_key]?.trim()) return `${f.field_name} is required`;
    }
  }
  return null;
}

export function productsWithRequiredData(
  products: Product[],
  fields: RequiredDataField[]
): Product[] {
  return products.filter((product) => {
    const { buyer, seller } = productRequiredFields(product, fields);
    return buyer.length > 0 || seller.length > 0;
  });
}

export function inputType(fieldType: RequiredDataField["field_type"]): string {
  switch (fieldType) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "boolean":
      return "checkbox";
    default:
      return "text";
  }
}
