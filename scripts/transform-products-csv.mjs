#!/usr/bin/env node
/**
 * Transform external products-all.csv into ConveyX bulk-import format.
 * Usage: node scripts/transform-products-csv.mjs [input.csv] [output-dir]
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath = resolve(process.argv[2] ?? join(process.env.HOME ?? "", "Downloads/products-all.csv"));
const outputDir = resolve(process.argv[3] ?? join(__dirname, "../data/import"));

const TYPE_MAP = {
  "body corporate": "BodyCorp",
  "council certificate": "LGA",
  "lga certificate": "LGA",
  "utility certificate": "Utility",
  "state government certificate": "State_government",
  "other providers": "Other",
};

/** Map variant spellings to the canonical name in providers-all.csv */
const PROVIDER_ALIASES = {
  "mbcm strata specialist": "MBCM STRATA Specialists",
};

function loadProviderCanonicalMap(providersCsvPath) {
  const map = new Map(Object.entries(PROVIDER_ALIASES));
  if (!existsSync(providersCsvPath)) return map;

  const text = readFileSync(providersCsvPath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return map;

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = headers.indexOf("provider_name");
  if (nameIdx < 0) return map;

  for (const line of lines.slice(1)) {
    const name = parseCsvLine(line)[nameIdx]?.trim();
    if (name) map.set(name.toLowerCase(), name);
  }
  return map;
}

function normalizeProviderName(name, canonicalMap) {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return "";
  return canonicalMap.get(trimmed.toLowerCase()) ?? trimmed;
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

function csvEscape(value) {
  const s = value ?? "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function mapType(raw) {
  return TYPE_MAP[raw?.trim().toLowerCase()] ?? "Other";
}

function mapDisplay(raw) {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "yes" || v === "y" || v === "true" || v === "1" ? "true" : "false";
}

function mapStatus(raw) {
  const v = (raw ?? "draft").trim().toLowerCase();
  return v === "active" ? "active" : v === "deprecated" ? "deprecated" : "draft";
}

function mapGst(raw) {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "normal_gst_10";
  if (["no_gst", "no gst", "no gst on certificate", "gst free", "gst_free"].includes(v)) {
    return "no_gst";
  }
  if (["fixed_gst_percent", "fixed gst percent", "fixed gst %"].includes(v)) {
    return "fixed_gst_percent";
  }
  if (["fixed_gst_amount", "fixed gst amount"].includes(v)) {
    return "fixed_gst_amount";
  }
  return "normal_gst_10";
}

function mapMoney(raw) {
  const v = (raw ?? "").trim();
  if (!v) return "";
  const cleaned = v.replace(/[$,\s]/g, "");
  return Number.isFinite(Number(cleaned)) ? cleaned : "";
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const canonicalProviders = loadProviderCanonicalMap(join(outputDir, "providers-all.csv"));

  const rl = createInterface({ input: createReadStream(inputPath, { encoding: "utf8" }) });
  let headers = null;
  const products = [];
  const providers = new Map();

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    if (!headers) {
      headers = cells.map((h) => h.toLowerCase());
      continue;
    }
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });

    const providerName = normalizeProviderName(row.provider_name, canonicalProviders);
    if (providerName && !providers.has(providerName.toLowerCase())) {
      providers.set(providerName.toLowerCase(), providerName);
    }

    products.push({
      product_name: row.product_name ?? "",
      sku: row.sku ?? "",
      state: row.state ?? "",
      type: mapType(row.type),
      display_on_ui: mapDisplay(row.display_on_ui),
      description: row.description ?? "",
      council: row.council?.trim() || "ALL",
      provider_name: providerName,
      cost: mapMoney(row.cost),
      retail_price: mapMoney(row.retail_price),
      gst_option: mapGst(row.gst_option),
      gst_amount: mapMoney(row.gst_amount),
      fulfillment_method: row.fulfillment_method?.trim() || "Manual",
      status: mapStatus(row.status),
      required_data_buyer: row.required_data_buyer?.trim() || "",
      required_data_seller: row.required_data_seller?.trim() || "",
    });
  }

  const productHeaders = [
    "product_name",
    "sku",
    "state",
    "type",
    "display_on_ui",
    "description",
    "council",
    "provider_name",
    "cost",
    "retail_price",
    "gst_option",
    "gst_amount",
    "fulfillment_method",
    "status",
    "required_data_buyer",
    "required_data_seller",
  ];

  const providerHeaders = ["provider_name", "payment_method", "description", "email"];

  const productsCsv = [
    productHeaders.join(","),
    ...products.map((p) => productHeaders.map((h) => csvEscape(p[h])).join(",")),
  ].join("\n");

  const providersCsv = [
    providerHeaders.join(","),
    ...[...providers.values()].sort((a, b) => a.localeCompare(b)).map((name) =>
      [name, "invoice", `Imported from products catalog`, ""].map(csvEscape).join(",")
    ),
  ].join("\n");

  const productsOut = join(outputDir, "products-all.csv");
  const providersOut = join(outputDir, "providers-all.csv");

  writeFileSync(productsOut, productsCsv, "utf8");
  writeFileSync(providersOut, providersCsv, "utf8");

  console.log(`Input:     ${inputPath}`);
  console.log(`Products:  ${productsOut} (${products.length} rows)`);
  console.log(`Providers: ${providersOut} (${providers.size} rows)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
