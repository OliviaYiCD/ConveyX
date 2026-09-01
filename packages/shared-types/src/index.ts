export type EntityType = "master" | "branch";
export type EntityStatus = "active" | "suspended";
export type BillingPreference = "invoice" | "card";
export type BillingCycle = "weekly" | "fortnightly" | "monthly";
export type UserStatus = "active" | "inactive";

export type Role =
  | "entity_admin"
  | "entity_billing"
  | "entity_user"
  | "conveyx_admin"
  | "conveyx_ops";

export interface Entity {
  id: string;
  name: string;
  entity_type: EntityType;
  parent_entity_id: string | null;
  abn: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface EntitySettings {
  entity_id: string;
  billing_preference: BillingPreference;
  billing_cycle: BillingCycle | null;
  payment_terms_days: number;
  stripe_customer_id: string | null;
  invoice_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  entity_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  entity_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleAssignment {
  id: string;
  user_id: string;
  entity_id: string;
  role: Role;
  created_at: string;
}

export interface RequestMeta {
  request_id: string;
  timestamp: string;
  page?: number;
  page_size?: number;
  total?: number;
}

export interface ApiResponse<T> {
  data: T;
  meta: RequestMeta;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta: Pick<RequestMeta, "request_id">;
}

export interface CreateEntityInput {
  name: string;
  entity_type: EntityType;
  parent_entity_id?: string | null;
  abn?: string | null;
}

export interface UpdateEntityInput {
  name?: string;
  abn?: string | null;
  status?: EntityStatus;
}

export interface UpdateEntitySettingsInput {
  billing_preference?: BillingPreference;
  billing_cycle?: BillingCycle | null;
  payment_terms_days?: number;
  invoice_email?: string | null;
  stripe_customer_id?: string | null;
}

export interface CreateUserProfileInput {
  id: string;
  entity_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  roles?: Role[];
}

export interface CreateTeamInput {
  entity_id: string;
  name: string;
  description?: string | null;
}

export interface AddTeamMemberInput {
  user_id: string;
}

// --- SKU domain (Phase 1) ---

export type AuState = "QLD" | "VIC" | "NSW" | "SA" | "WA" | "NT" | "ACT" | "TAS";
export type ProductType = "LGA" | "BodyCorp" | "LandInfo" | "State_government" | "Utility" | "Other";
export type GstOption = "no_gst" | "normal_gst_10" | "fixed_gst_percent" | "fixed_gst_amount";
export type FulfillmentMethod = "API" | "Automation" | "Manual";
export type ProductStatus = "draft" | "active" | "deprecated";
export type RequiredDataFieldType = "text" | "number" | "binary" | "date" | "select" | "boolean";
export type PackageScopeType = "global" | "state" | "council";

export interface Provider {
  provider_id: string;
  provider_name: string;
  provider_type: ProductType | null;
  state: AuState | null;
  payment_method: string | null;
  payment_details: Record<string, unknown>;
  description: string | null;
  address: string | null;
  email: string | null;
  contact_number: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderListResult {
  items: Provider[];
  total: number;
}

export interface RequiredDataField {
  field_id: number;
  field_name: string;
  field_type: RequiredDataFieldType;
  field_key: string;
  validation_rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Council {
  code: string;
  name: string;
  state: AuState;
}

export interface Product {
  id: string;
  product_name: string;
  sku: string;
  state: AuState;
  type: ProductType;
  display_on_ui: boolean;
  description: string | null;
  council: string;
  provider_id: string;
  required_data_buyer: number[];
  required_data_seller: number[];
  cost: number;
  retail_price: number;
  gst_option: GstOption;
  gst_amount: number | null;
  fulfillment_method: FulfillmentMethod;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductListResult {
  items: Product[];
  total: number;
}

export interface Package {
  id: string;
  package_name: string;
  description: string | null;
  scope_type: PackageScopeType;
  scope_state: AuState | null;
  scope_council: string | null;
  display_on_ui: boolean;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface PackageItem {
  product_id: string;
  sort_order: number;
  is_optional: boolean;
  product?: Product;
}

export interface PackageDetail {
  package: Package;
  items: PackageItem[];
}

export interface CreateProviderInput {
  provider_name: string;
  provider_type?: ProductType | null;
  state?: AuState | null;
  payment_method?: string | null;
  payment_details?: Record<string, unknown>;
  description?: string | null;
  address?: string | null;
  email?: string | null;
  contact_number?: string | null;
  website?: string | null;
}

export interface CreateRequiredDataInput {
  field_name: string;
  field_type: RequiredDataFieldType;
  field_key: string;
  validation_rules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreateProductInput {
  product_name: string;
  sku: string;
  state: AuState;
  type: ProductType;
  display_on_ui?: boolean;
  description?: string | null;
  council?: string;
  provider_id: string;
  required_data_buyer?: number[];
  required_data_seller?: number[];
  cost?: number;
  retail_price?: number;
  gst_option?: GstOption;
  gst_amount?: number | null;
  fulfillment_method?: FulfillmentMethod;
  status?: ProductStatus;
}

export interface CreatePackageInput {
  package_name: string;
  description?: string | null;
  scope_type: PackageScopeType;
  scope_state?: AuState | null;
  scope_council?: string | null;
  display_on_ui?: boolean;
  status?: ProductStatus;
  items?: { product_id: string; sort_order?: number; is_optional?: boolean }[];
}

export interface BulkImportError {
  row: number;
  key?: string;
  message: string;
}

export interface BulkImportResult<T> {
  created: T[];
  errors: BulkImportError[];
  total: number;
}

// --- Catalog intelligence (Phase 2) ---

export type PropertyIdentifierType = "title_reference" | "vol_fol" | "lot_plan" | "address";

export interface PropertyIdentifierRequest {
  identifier_type: PropertyIdentifierType;
  value: string;
  entity_id?: string;
  include_body_corp?: boolean;
}

export interface PropertyContextHints {
  is_strata?: boolean;
  plan_type?: string;
  /** Resolved suburb name (VIC mapping). */
  suburb?: string;
  /** VIC region label from suburb mapping. */
  region?: string;
  /** LGA product council names for the address suburb (may be multiple). */
  lga_councils?: string[];
  /** Utility product council names for the address suburb (may be multiple). */
  water_authorities?: string[];
  /** Display name of the water provider from suburb mapping. */
  water_provider?: string;
}

export interface PropertyContext {
  identifier_type: PropertyIdentifierType;
  value: string;
  normalized_identifier: string;
  state: AuState;
  council: string | null;
  confidence: number;
  hints: PropertyContextHints;
}

export interface RecommendedProduct {
  product: Product;
  rank: number;
  reason: string;
}

export interface RecommendedPackage {
  package: Package;
  products: Product[];
  rank: number;
  reason: string;
}

export interface RecommendationResponse {
  context: PropertyContext;
  packages: RecommendedPackage[];
  products: RecommendedProduct[];
}

// --- Order & billing (Phase 2) ---

export type OrderStatus =
  | "draft"
  | "submitted"
  | "pending_payment"
  | "paid"
  | "fulfilling"
  | "completed"
  | "failed"
  | "cancelled";

export type TransactionStatus = "pending" | "invoiced" | "paid" | "void";
export type InvoiceStatus = "draft" | "issued" | "paid" | "void";

export interface Order {
  id: string;
  entity_id: string;
  status: OrderStatus;
  property_address: string;
  property_context: PropertyContext;
  include_body_corp: boolean;
  subtotal: number;
  gst_total: number;
  total: number;
  created_at: string;
  updated_at: string;
}

/** Order row returned by cx_list_orders with search enrichment. */
export interface OrderListItem extends Order {
  customer_name?: string | null;
  product_names?: string[];
}

export interface OrderLine {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  product_type: ProductType;
  quantity: number;
  unit_price: number;
  gst_amount: number;
  line_total: number;
  required_data_buyer: Record<string, unknown>;
  required_data_seller: Record<string, unknown>;
  sort_order: number;
  created_at: string;
}

export interface OrderDetail {
  order: Order;
  lines: OrderLine[];
}

export interface CreateOrderLineInput {
  product_id: string;
  quantity?: number;
  required_data_buyer?: Record<string, unknown>;
  required_data_seller?: Record<string, unknown>;
}

export interface CreateOrderInput {
  entity_id: string;
  property_address: string;
  property_context: PropertyContext;
  include_body_corp?: boolean;
  lines: CreateOrderLineInput[];
}

export interface Transaction {
  id: string;
  order_id: string;
  entity_id: string;
  reference: string;
  description: string | null;
  amount: number;
  gst_amount: number;
  total: number;
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  entity_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal: number;
  gst_total: number;
  total: number;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  transaction_id: string;
  order_id: string;
  description: string;
  amount: number;
  gst_amount: number;
  line_total: number;
  created_at: string;
}

export interface InvoiceDetail {
  invoice: Invoice;
  lines: InvoiceLine[];
}

export interface GenerateInvoiceInput {
  entity_id: string;
  transaction_ids?: string[];
}

