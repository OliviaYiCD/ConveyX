import type { PropertyContext, PropertyContextHints } from "@conveyx/shared-types";
import mappingData from "../data/vic-suburb-mapping.json" with { type: "json" };

export interface VicSuburbRecord {
  suburb: string;
  postcode: string;
  region: string;
  councils: string[];
  water_authority: string | null;
  water_provider: string;
}

interface VicMappingData {
  suburbs: VicSuburbRecord[];
  council_aliases: Record<string, string>;
  water_authorities: Record<string, string>;
}

const mapping = mappingData as VicMappingData;

const WATER_AUTHORITY_ALIASES: Record<string, string[]> = {
  "Lower Murray Urban": ["Lower Murray Urban", "Lower Murray Rural"],
};

const suburbByKey = new Map<string, VicSuburbRecord>();
const postcodeToSuburbs = new Map<string, VicSuburbRecord[]>();

for (const record of mapping.suburbs) {
  suburbByKey.set(normalizeSuburbKey(record.suburb), record);
  const list = postcodeToSuburbs.get(record.postcode) ?? [];
  list.push(record);
  postcodeToSuburbs.set(record.postcode, list);
}

/** Suburb keys sorted longest-first so "East Melbourne" wins over "Melbourne". */
const suburbKeysByLength = [...suburbByKey.keys()].sort((a, b) => b.length - a.length);

export function normalizeSuburbKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function waterAuthoritiesForProvider(waterProvider: string): string[] {
  const primary = mapping.water_authorities[waterProvider];
  if (!primary) return [];
  return WATER_AUTHORITY_ALIASES[primary] ?? [primary];
}

export function lookupVicSuburb(suburb: string): VicSuburbRecord | null {
  return suburbByKey.get(normalizeSuburbKey(suburb)) ?? null;
}

export function lookupVicSuburbByPostcode(postcode: string): VicSuburbRecord | null {
  const matches = postcodeToSuburbs.get(postcode);
  if (!matches?.length) return null;
  return matches[0]!;
}

export function findVicSuburbInAddress(address: string): VicSuburbRecord | null {
  const normalized = normalizeSuburbKey(address);

  for (const key of suburbKeysByLength) {
    const boundary = new RegExp(`\\b${escapeRegExp(key)}\\b`, "i");
    if (boundary.test(normalized)) {
      return suburbByKey.get(key) ?? null;
    }
  }

  const postcodeMatch = address.match(/\b(3\d{3})\b/);
  if (postcodeMatch) {
    return lookupVicSuburbByPostcode(postcodeMatch[1]!);
  }

  return null;
}

export function vicHintsFromSuburb(record: VicSuburbRecord): PropertyContextHints {
  return {
    suburb: record.suburb,
    region: record.region,
    lga_councils: record.councils,
    water_authorities: waterAuthoritiesForProvider(record.water_provider),
    water_provider: record.water_provider,
  };
}

export function enrichVicAddressContext(
  address: string,
  base: Pick<PropertyContext, "state" | "council" | "confidence" | "hints">
): Pick<PropertyContext, "council" | "confidence" | "hints"> {
  const record = findVicSuburbInAddress(address);
  if (!record) {
    return { council: base.council, confidence: base.confidence, hints: base.hints };
  }

  const vicHints = vicHintsFromSuburb(record);
  let confidence = Math.max(base.confidence, 0.92);
  if (/\b\d{4}\b/.test(address)) confidence = Math.min(confidence + 0.03, 0.98);

  return {
    council: record.councils[0] ?? base.council,
    confidence,
    hints: { ...base.hints, ...vicHints },
  };
}

/** Body corp products name a suburb in a dash-separated location segment. */
export function bodyCorpMatchesSuburb(productName: string, suburb: string): boolean {
  const target = normalizeSuburbKey(suburb);
  const parts = productName.split(" - ").map((part) => part.trim());

  for (const part of parts.slice(1)) {
    const partKey = normalizeSuburbKey(part);
    if (partKey === target || partKey.startsWith(`${target} `)) {
      return true;
    }
  }

  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
