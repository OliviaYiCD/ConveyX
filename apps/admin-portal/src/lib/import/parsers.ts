import type {
  AuState,
  CreatePackageInput,
  CreateProductInput,
  CreateProviderInput,
  CreateRequiredDataInput,
  FulfillmentMethod,
  GstOption,
  Product,
  ProductStatus,
  ProductType,
  Provider,
  RequiredDataField,
  RequiredDataFieldType,
} from "@conveyx/shared-types";
import {
  parseBoolean,
  parseJsonField,
  parseNumber,
  parsePipeList,
} from "../csv";
import {
  AU_STATES,
  FIELD_TYPES,
  FULFILLMENT_METHODS,
  GST_OPTIONS,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
} from "../constants";

export interface ParsedRow<T> {
  row: number;
  data?: T;
  errors: string[];
}

function rowNum(index: number): number {
  return index + 2;
}

function requireField(obj: Record<string, string>, key: string, errors: string[]): string {
  const v = obj[key]?.trim();
  if (!v) errors.push(`${key} is required`);
  return v ?? "";
}

function enumField<T extends string>(
  value: string,
  allowed: readonly T[],
  field: string,
  errors: string[],
  options?: { caseInsensitive?: boolean }
): T | null {
  if (!value) return null;
  if (allowed.includes(value as T)) return value as T;
  if (options?.caseInsensitive) {
    const lower = value.trim().toLowerCase();
    const match = allowed.find((a) => a.toLowerCase() === lower);
    if (match) return match;
  }
  errors.push(`${field} must be one of: ${allowed.join(", ")}`);
  return null;
}

const PRODUCT_TYPE_ALIASES: Record<string, ProductType> = {
  "body corporate": "BodyCorp",
  bodycorp: "BodyCorp",
  "lga certificate": "LGA",
  "council certificate": "LGA",
  lga: "LGA",
  "utility certificate": "Utility",
  utility: "Utility",
  "state government certificate": "State_government",
  state_government: "State_government",
  "other providers": "Other",
  other: "Other",
  landinfo: "LandInfo",
};

const GST_ALIASES: Record<string, GstOption> = {
  no_gst: "no_gst",
  "no gst": "no_gst",
  "no gst on certificate": "no_gst",
  "gst free": "no_gst",
  gst_free: "no_gst",
  normal_gst_10: "normal_gst_10",
  "normal gst 10": "normal_gst_10",
  "gst on certificate": "normal_gst_10",
  gst: "normal_gst_10",
  "10%": "normal_gst_10",
  "10": "normal_gst_10",
  fixed_gst_percent: "fixed_gst_percent",
  "fixed gst percent": "fixed_gst_percent",
  "fixed gst %": "fixed_gst_percent",
  fixed_gst_amount: "fixed_gst_amount",
  "fixed gst amount": "fixed_gst_amount",
};

function parseGstOption(raw: string, errors: string[]): GstOption | null {
  const value = (raw || "normal_gst_10").trim();
  const alias = GST_ALIASES[value.toLowerCase()];
  if (alias) return alias;
  return enumField(value, GST_OPTIONS.map((g) => g.value), "gst_option", errors);
}

function parseProductType(raw: string, errors: string[]): ProductType | null {
  if (!raw?.trim()) return null;
  const alias = PRODUCT_TYPE_ALIASES[raw.trim().toLowerCase()];
  if (alias) return alias;
  return enumField(raw, PRODUCT_TYPES, "type", errors);
}

function optionalNumber(
  raw: string | undefined,
  field: string,
  errors: string[]
): number | null {
  if (!raw?.trim()) return null;
  const n = parseNumber(raw);
  if (n === null) errors.push(`${field} must be a number`);
  return n;
}

export function resolveFieldIds(
  raw: string,
  fields: RequiredDataField[],
  label: string,
  errors: string[]
): number[] {
  if (!raw) return [];
  const byKey = new Map(fields.map((f) => [f.field_key, f.field_id]));
  const ids: number[] = [];
  for (const token of parsePipeList(raw)) {
    if (/^\d+$/.test(token)) {
      ids.push(Number(token));
      continue;
    }
    const id = byKey.get(token);
    if (id === undefined) {
      errors.push(`${label}: unknown field "${token}"`);
    } else {
      ids.push(id);
    }
  }
  return ids;
}

export function resolveProviderId(
  row: Record<string, string>,
  providers: Provider[],
  errors: string[]
): string {
  const byId = row.provider_id?.trim();
  if (byId) {
    // Trust CSV provider_id — do not require a local lookup match.
    return byId;
  }
  const name = row.provider_name?.trim();
  if (!name) {
    errors.push("provider_id or provider_name is required");
    return "";
  }
  const match = providers.find((p) => p.provider_name.toLowerCase() === name.toLowerCase());
  if (!match) {
    errors.push(`provider not found: ${name}`);
    return "";
  }
  return match.provider_id;
}

export function parseProductRows(
  objects: Record<string, string>[],
  providers: Provider[],
  fields: RequiredDataField[]
): ParsedRow<CreateProductInput>[] {
  return objects.map((obj, i) => {
    const errors: string[] = [];
    const state = enumField(obj.state, AU_STATES, "state", errors);
    const type = parseProductType(obj.type, errors);
    const gst = parseGstOption(obj.gst_option, errors);
    const fulfillment = enumField(
      obj.fulfillment_method || "Manual",
      FULFILLMENT_METHODS,
      "fulfillment_method",
      errors,
      { caseInsensitive: true }
    );
    const status =
      enumField(obj.status || "draft", PRODUCT_STATUSES, "status", errors, {
        caseInsensitive: true,
      }) ?? "draft";
    const cost = optionalNumber(obj.cost, "cost", errors);
    const retail = optionalNumber(obj.retail_price, "retail_price", errors);

    const gstAmountRaw = obj.gst_amount?.trim();
    let gst_amount: number | null = null;
    if (gstAmountRaw) {
      gst_amount = parseNumber(gstAmountRaw);
      if (gst_amount === null) errors.push("gst_amount must be a number");
    }

    const data: CreateProductInput = {
      product_name: requireField(obj, "product_name", errors),
      sku: requireField(obj, "sku", errors),
      state: state ?? ("NSW" as AuState),
      type: type ?? ("Other" as ProductType),
      display_on_ui: parseBoolean(obj.display_on_ui, true),
      description: obj.description || null,
      council: obj.council?.trim() || "ALL",
      provider_id: resolveProviderId(obj, providers, errors),
      required_data_buyer: resolveFieldIds(obj.required_data_buyer, fields, "required_data_buyer", errors),
      required_data_seller: resolveFieldIds(obj.required_data_seller, fields, "required_data_seller", errors),
      cost: cost ?? 0,
      retail_price: retail ?? 0,
      gst_option: gst ?? ("normal_gst_10" as GstOption),
      gst_amount,
      fulfillment_method: fulfillment ?? ("Manual" as FulfillmentMethod),
      status: status as ProductStatus,
    };

    return { row: rowNum(i), data: errors.length ? undefined : data, errors };
  });
}

export function parseProviderRows(objects: Record<string, string>[]): ParsedRow<CreateProviderInput>[] {
  const PROVIDER_TYPE_ALIASES: Record<string, ProductType> = {
    lga: "LGA",
    "state government": "State_government",
    state_government: "State_government",
    "body corp": "BodyCorp",
    bodycorp: "BodyCorp",
    "body corporate": "BodyCorp",
    utility: "Utility",
    "state land register": "LandInfo",
    landinfo: "LandInfo",
    other: "Other",
  };

  function parseProviderType(raw: string, errors: string[]): ProductType | null {
    if (!raw?.trim()) return null;
    const alias = PROVIDER_TYPE_ALIASES[raw.trim().toLowerCase()];
    if (alias) return alias;
    return enumField(raw, PRODUCT_TYPES, "provider_type", errors);
  }

  return objects.map((obj, i) => {
    const errors: string[] = [];
    const state = obj.state?.trim()
      ? enumField(obj.state, AU_STATES, "state", errors)
      : null;
    const data: CreateProviderInput = {
      provider_name: requireField(obj, "provider_name", errors),
      provider_type: parseProviderType(obj.provider_type ?? obj.type ?? "", errors),
      state: state ?? null,
      payment_method: obj.payment_method || null,
      payment_details: parseJsonField(obj.payment_details),
      description: obj.description || null,
      address: obj.address || null,
      email: obj.email || null,
      contact_number: obj.contact_number || null,
      website: obj.website || null,
    };
    return { row: rowNum(i), data: errors.length ? undefined : data, errors };
  });
}

export function parseRequiredDataRows(
  objects: Record<string, string>[]
): ParsedRow<CreateRequiredDataInput>[] {
  return objects.map((obj, i) => {
    const errors: string[] = [];
    const fieldType = enumField(obj.field_type, FIELD_TYPES, "field_type", errors);
    const data: CreateRequiredDataInput = {
      field_name: requireField(obj, "field_name", errors),
      field_type: fieldType ?? ("text" as RequiredDataFieldType),
      field_key: requireField(obj, "field_key", errors),
      validation_rules: parseJsonField(obj.validation_rules),
      metadata: parseJsonField(obj.metadata),
    };
    return { row: rowNum(i), data: errors.length ? undefined : data, errors };
  });
}

export function parsePackageRows(
  objects: Record<string, string>[],
  products: Product[]
): ParsedRow<CreatePackageInput>[] {
  const bySku = new Map(products.map((p) => [p.sku.toLowerCase(), p]));

  return objects.map((obj, i) => {
    const errors: string[] = [];
    const scope = enumField(
      obj.scope_type,
      ["global", "state", "council"] as const,
      "scope_type",
      errors
    );
    const status = enumField(obj.status || "draft", PRODUCT_STATUSES, "status", errors) ?? "draft";
    const scopeState = obj.scope_state?.trim() as AuState | undefined;

    if (scope === "state" && scopeState && !AU_STATES.includes(scopeState)) {
      errors.push("scope_state invalid");
    }
    if (scope === "council" && !obj.scope_council?.trim()) {
      errors.push("scope_council required for council scope");
    }

    const skus = parsePipeList(obj.product_skus);
    const items = skus.map((sku, idx) => {
      const product = bySku.get(sku.toLowerCase());
      if (!product) {
        errors.push(`product SKU not found: ${sku}`);
        return null;
      }
      return {
        product_id: product.id,
        sort_order: idx,
        is_optional: parseBoolean(obj.is_optional, false),
      };
    });

    const data: CreatePackageInput = {
      package_name: requireField(obj, "package_name", errors),
      description: obj.description || null,
      scope_type: scope ?? "global",
      scope_state: scopeState ?? null,
      scope_council: obj.scope_council?.trim() || null,
      display_on_ui: parseBoolean(obj.display_on_ui, true),
      status: status as ProductStatus,
      items: items.filter(Boolean) as CreatePackageInput["items"],
    };

    return { row: rowNum(i), data: errors.length ? undefined : data, errors };
  });
}
