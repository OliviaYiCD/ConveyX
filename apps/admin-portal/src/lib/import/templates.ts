export const CSV_TEMPLATES = {
  products: `product_name,sku,state,type,display_on_ui,description,council,provider_id,cost,retail_price,gst_option,gst_amount,fulfillment_method,status,required_data_buyer,required_data_seller
NSW Plan Search,NSW-PLAN-001,NSW,LandInfo,true,Deposited plan search NSW,ALL,00000000-0000-0000-0000-000000000001,20.00,40.00,normal_gst_10,,API,draft,buyer_full_name,seller_full_name
Sydney Drainage Diagram,NSW-LGA-SYD-DRAIN,NSW,LGA,true,Drainage diagram Sydney,SYDNEY,00000000-0000-0000-0000-000000000002,12.00,30.00,normal_gst_10,,Manual,active,buyer_full_name|company_abn,`,

  providers: `provider_name,provider_type,state,description,email,contact_number,address,website,payment_method,payment_details
Example Council,LGA,NSW,Local council certificates,,,123 Main St,,invoice,{}`,

  requiredData: `field_name,field_type,field_key,validation_rules,metadata
Buyer phone,text,buyer_phone,{},"{""placeholder"":""04xx xxx xxx""}"
Settlement date,date,settlement_date,{},{}`,

  packages: `package_name,description,scope_type,scope_state,scope_council,display_on_ui,status,product_skus,is_optional
NSW Premium Package,Extended NSW searches,state,NSW,,true,draft,NSW-TITLE-001|NSW-LGA-SYD-RATES,false`,
} as const;

export type ImportKind = keyof typeof CSV_TEMPLATES;

export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  products: "Products",
  providers: "Providers",
  requiredData: "Required data fields",
  packages: "Packages",
};

export const IMPORT_ORDER: ImportKind[] = ["providers", "requiredData", "products", "packages"];

export const IMPORT_HINTS: Record<ImportKind, string> = {
  providers: "Import providers first — products reference provider_id from the Providers page.",
  requiredData: "Use field_key values in product CSV for required_data_buyer / required_data_seller (pipe-separated).",
  products: "Prefer provider_id (UUID). provider_name still works as a fallback. cost and retail_price are optional (default 0).",
  packages: "product_skus lists SKU codes pipe-separated. Import products before packages.",
};
