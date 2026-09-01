#!/usr/bin/env node
/**
 * Resolve provider_name → provider_id from the live API and rewrite products-all.csv.
 *
 * Usage:
 *   node scripts/attach-product-provider-ids.mjs
 *   API_BASE=http://localhost:3000 node scripts/attach-product-provider-ids.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const importDir = resolve(process.argv[2] ?? join(__dirname, "../data/import"));
const apiBase = (process.env.API_BASE ?? "http://localhost:3000").replace(/\/$/, "");

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

async function fetchAllProviders() {
  const all = [];
  let page = 1;
  let total = Infinity;
  while (all.length < total) {
    const res = await fetch(`${apiBase}/v1/providers?page=${page}&page_size=200`);
    if (!res.ok) {
      throw new Error(`Failed to fetch providers (${res.status}): ${await res.text()}`);
    }
    const json = await res.json();
    const items = json.data ?? [];
    total = json.meta?.total ?? items.length;
    all.push(...items);
    if (items.length === 0) break;
    page += 1;
  }
  return all;
}

async function main() {
  const providers = await fetchAllProviders();
  const byName = new Map(
    providers.map((p) => [String(p.provider_name).trim().toLowerCase(), p.provider_id])
  );

  const productsPath = join(importDir, "products-all.csv");
  const text = readFileSync(productsPath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const lower = headers.map((h) => h.toLowerCase());

  let nameIdx = lower.indexOf("provider_name");
  let idIdx = lower.indexOf("provider_id");

  const outHeaders = [...headers];
  if (idIdx < 0) {
    // Insert provider_id after provider_name when present, else at end.
    const insertAt = nameIdx >= 0 ? nameIdx + 1 : outHeaders.length;
    outHeaders.splice(insertAt, 0, "provider_id");
    idIdx = insertAt;
    if (nameIdx >= 0 && nameIdx >= insertAt) nameIdx += 1;
  }

  let resolved = 0;
  let missing = 0;
  const out = [outHeaders.map(csvEscape).join(",")];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    // Align cell count to original headers before optional insert.
    while (cells.length < headers.length) cells.push("");
    if (cells.length > headers.length) cells.length = headers.length;

    if (headers.length !== outHeaders.length) {
      cells.splice(idIdx, 0, "");
    }

    const existingId = cells[idIdx]?.trim();
    const name = nameIdx >= 0 ? cells[nameIdx]?.trim() : "";
    let id = existingId;
    if (!id && name) {
      id = byName.get(name.toLowerCase()) ?? "";
    }
    if (id) resolved += 1;
    else missing += 1;
    cells[idIdx] = id;
    out.push(cells.map(csvEscape).join(","));
  }

  writeFileSync(productsPath, `${out.join("\n")}\n`, "utf8");
  console.log(`API:       ${apiBase}`);
  console.log(`Providers: ${providers.length}`);
  console.log(`Resolved:  ${resolved}`);
  console.log(`Missing:   ${missing}`);
  console.log(`Wrote:     ${productsPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
