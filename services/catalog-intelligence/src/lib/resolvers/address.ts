import type { AuState, PropertyContext, PropertyContextHints } from "@conveyx/shared-types";
import { enrichVicAddressContext } from "../vic-mapping.js";

const AU_STATES: AuState[] = ["QLD", "VIC", "NSW", "SA", "WA", "NT", "ACT", "TAS"];

const STATE_ALIASES: Record<string, AuState> = {
  qld: "QLD",
  queensland: "QLD",
  vic: "VIC",
  victoria: "VIC",
  nsw: "NSW",
  "new south wales": "NSW",
  sa: "SA",
  "south australia": "SA",
  wa: "WA",
  "western australia": "WA",
  nt: "NT",
  "northern territory": "NT",
  act: "ACT",
  "australian capital territory": "ACT",
  tas: "TAS",
  tasmania: "TAS",
};

/** POC mock geocoding — suburb/city keyword → state + council code (matches sku.councils seed). */
const LOCATION_LOOKUP: { pattern: RegExp; state: AuState; council: string }[] = [
  { pattern: /\bsydney\b/i, state: "NSW", council: "SYDNEY" },
  { pattern: /\bparramatta\b/i, state: "NSW", council: "PARRAMATTA" },
  { pattern: /\bnewcastle\b/i, state: "NSW", council: "NEWCASTLE" },
  { pattern: /\bwollongong\b/i, state: "NSW", council: "WOLLONGONG" },
  { pattern: /\bmelbourne\b/i, state: "VIC", council: "MELBOURNE" },
  { pattern: /\bgeelong\b/i, state: "VIC", council: "GEELONG" },
  { pattern: /\bballarat\b/i, state: "VIC", council: "BALLARAT" },
  { pattern: /\bbrisbane\b/i, state: "QLD", council: "BRISBANE" },
  { pattern: /\bgold\s*coast\b/i, state: "QLD", council: "GOLD_COAST" },
  { pattern: /\bsunshine\s*coast\b/i, state: "QLD", council: "SUNSHINE_COAST" },
  { pattern: /\badelaide\b/i, state: "SA", council: "ADELAIDE" },
  { pattern: /\bonkaparinga\b/i, state: "SA", council: "ONKAPARINGA" },
  { pattern: /\bperth\b/i, state: "WA", council: "PERTH" },
  { pattern: /\bstirling\b/i, state: "WA", council: "STIRLING" },
  { pattern: /\bhobart\b/i, state: "TAS", council: "HOBART" },
  { pattern: /\blaunceston\b/i, state: "TAS", council: "LAUNCESTON" },
  { pattern: /\bdarwin\b/i, state: "NT", council: "DARWIN" },
  { pattern: /\bcanberra\b/i, state: "ACT", council: "CANBERRA" },
];

const STRATA_KEYWORDS = /\b(unit|apartment|apt|suite|strata|sp\s*\d|lot\s*\d+\s*\/\s*sp)/i;

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function detectStateFromText(text: string): AuState | null {
  const upper = text.toUpperCase();

  for (const state of AU_STATES) {
    const boundary = new RegExp(`\\b${state}\\b`);
    if (boundary.test(upper)) return state;
  }

  const lower = text.toLowerCase();
  for (const [alias, state] of Object.entries(STATE_ALIASES)) {
    const boundary = new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (boundary.test(lower)) return state;
  }

  const postcodeMatch = text.match(/\b(\d{4})\b/);
  if (postcodeMatch) {
    const pc = Number(postcodeMatch[1]);
    if (pc >= 2000 && pc <= 2599) return "NSW";
    if (pc >= 2600 && pc <= 2618) return "ACT";
    if (pc >= 2619 && pc <= 2899) return "NSW";
    if (pc >= 2900 && pc <= 2920) return "ACT";
    if (pc >= 2921 && pc <= 2999) return "NSW";
    if (pc >= 3000 && pc <= 3999) return "VIC";
    if (pc >= 4000 && pc <= 4999) return "QLD";
    if (pc >= 5000 && pc <= 5799) return "SA";
    if (pc >= 5800 && pc <= 5999) return "SA";
    if (pc >= 6000 && pc <= 6797) return "WA";
    if (pc >= 7000 && pc <= 7999) return "TAS";
    if (pc >= 800 && pc <= 999) return "NT";
  }

  return null;
}

export function detectCouncilFromText(text: string): string | null {
  for (const entry of LOCATION_LOOKUP) {
    if (entry.pattern.test(text)) return entry.council;
  }
  return null;
}

export function detectStrataHints(text: string): PropertyContextHints {
  const hints: PropertyContextHints = {};
  if (STRATA_KEYWORDS.test(text)) {
    hints.is_strata = true;
  }
  const spMatch = text.match(/\b(SP|BUP|CP)\s*(\d+)/i);
  if (spMatch) {
    hints.is_strata = true;
    hints.plan_type = spMatch[1]!.toUpperCase();
  }
  return hints;
}

export function buildContext(
  identifierType: PropertyContext["identifier_type"],
  value: string,
  state: AuState,
  council: string | null,
  confidence: number,
  hints: PropertyContextHints = {},
  normalizedIdentifier?: string
): PropertyContext {
  return {
    identifier_type: identifierType,
    value,
    normalized_identifier: normalizedIdentifier ?? normalizeWhitespace(value),
    state,
    council,
    confidence,
    hints,
  };
}

export function resolveAddress(value: string): PropertyContext {
  const normalized = normalizeWhitespace(value);
  const state = detectStateFromText(normalized);
  const council = detectCouncilFromText(normalized);
  const hints = detectStrataHints(normalized);

  if (!state) {
    throw new Error("Could not determine state from address — include suburb, state, or postcode");
  }

  let confidence = 0.75;
  if (council) confidence = 0.9;
  if (/\b\d{4}\b/.test(normalized)) confidence = Math.min(confidence + 0.05, 0.95);

  if (state === "VIC") {
    const enriched = enrichVicAddressContext(normalized, { state, council, confidence, hints });
    return buildContext(
      "address",
      value,
      state,
      enriched.council,
      enriched.confidence,
      enriched.hints,
      normalized
    );
  }

  return buildContext("address", value, state, council, confidence, hints);
}
