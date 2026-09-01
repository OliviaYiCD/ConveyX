import type {
  AuState,
  FulfillmentMethod,
  GstOption,
  ProductStatus,
  ProductType,
  RequiredDataFieldType,
} from "@conveyx/shared-types";

export const AU_STATES: AuState[] = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];

export const PRODUCT_TYPES: ProductType[] = [
  "LGA",
  "BodyCorp",
  "LandInfo",
  "State_government",
  "Utility",
  "Other",
];

export const PROVIDER_TYPE_LABELS: Record<ProductType, string> = {
  LGA: "LGA",
  State_government: "State government",
  BodyCorp: "Body corp",
  Utility: "Utility",
  LandInfo: "State land register",
  Other: "Other",
};

export const GST_OPTIONS: { value: GstOption; label: string }[] = [
  { value: "no_gst", label: "No GST" },
  { value: "normal_gst_10", label: "Normal GST (10%)" },
  { value: "fixed_gst_percent", label: "Fixed GST %" },
  { value: "fixed_gst_amount", label: "Fixed GST amount" },
];

export const FULFILLMENT_METHODS: FulfillmentMethod[] = ["API", "Automation", "Manual"];

export const PRODUCT_STATUSES: ProductStatus[] = ["draft", "active", "deprecated"];

export const FIELD_TYPES: RequiredDataFieldType[] = [
  "text",
  "number",
  "binary",
  "date",
  "select",
  "boolean",
];

export const PACKAGE_SCOPES = [
  { value: "global", label: "Global" },
  { value: "state", label: "State" },
  { value: "council", label: "Council" },
] as const;

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export function statusClass(status: ProductStatus): string {
  return `badge badge-${status}`;
}

export function orderStatusClass(status: string): string {
  return `badge badge-order badge-order-${status.replace(/_/g, "-")}`;
}
