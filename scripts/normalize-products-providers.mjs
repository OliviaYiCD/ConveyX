#!/usr/bin/env node
/**
 * Normalize provider_name values in products-all.csv to match providers-all.csv.
 * Usage: node scripts/normalize-products-providers.mjs [import-dir]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const importDir = resolve(process.argv[2] ?? join(__dirname, "../data/import"));

const PROVIDER_ALIASES = {
  "mbcm strata specialist": "MBCM STRATA Specialists",
};

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
  return cells;
}

function csvEscape(value) {
  const s = value ?? "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function loadProviderCanonicalMap(providersCsvPath) {
  const map = new Map(Object.entries(PROVIDER_ALIASES));
  if (!existsSync(providersCsvPath)) return map;

  const text = readFileSync(providersCsvPath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return map;

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("provider_name");
  if (nameIdx < 0) return map;

  for (const line of lines.slice(1)) {
    const name = parseCsvLine(line)[nameIdx]?.trim();
    if (name) map.set(name.toLowerCase(), name);
  }
  return map;
}

function main() {
  const productsPath = join(importDir, "products-all.csv");
  const providersPath = join(importDir, "providers-all.csv");
  const canonical = loadProviderCanonicalMap(providersPath);

  const text = readFileSync(productsPath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const nameIdx = headers.findIndex((h) => h.trim().toLowerCase() === "provider_name");
  if (nameIdx < 0) throw new Error("provider_name column not found");

  let changed = 0;
  const out = [headers.map(csvEscape).join(",")];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const raw = cells[nameIdx]?.trim() ?? "";
    const normalized = canonical.get(raw.toLowerCase()) ?? raw;
    if (normalized !== raw) changed += 1;
    cells[nameIdx] = normalized;
    out.push(cells.map(csvEscape).join(","));
  }

  writeFileSync(productsPath, `${out.join("\n")}\n`, "utf8");
  console.log(`Normalized ${changed} provider_name values in ${productsPath}`);
}

main();
