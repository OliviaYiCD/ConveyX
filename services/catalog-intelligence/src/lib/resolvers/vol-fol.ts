import type { PropertyContext } from "@conveyx/shared-types";
import { buildContext, detectStateFromText, normalizeWhitespace } from "./address.js";

const VOL_FOL_PATTERN = /\bvol(?:ume)?\.?\s*(\d+)\s*(?:,|\s+)?fol(?:io)?\.?\s*(\d+)\b/i;

/** Legacy vol/fol is state-ambiguous; explicit state in input raises confidence. */
export function resolveVolFol(value: string): PropertyContext {
  const normalized = normalizeWhitespace(value);
  const match = normalized.match(VOL_FOL_PATTERN);

  if (!match) {
    throw new Error("Could not parse vol/fol identifier — expected format like 'Vol 123 Fol 456'");
  }

  const vol = match[1]!;
  const fol = match[2]!;
  const normalizedIdentifier = `Vol ${vol} Fol ${fol}`;

  const explicitState = detectStateFromText(normalized);
  if (explicitState) {
    return buildContext("vol_fol", value, explicitState, null, 0.85, {}, normalizedIdentifier);
  }

  const inferredState = inferStateFromVolFol(Number(vol), Number(fol));
  if (inferredState) {
    return buildContext("vol_fol", value, inferredState, null, 0.55, {}, normalizedIdentifier);
  }

  throw new Error(
    "Could not determine state from vol/fol — include state (e.g. 'Vol 123 Fol 456 NSW')"
  );
}

function inferStateFromVolFol(vol: number, fol: number): PropertyContext["state"] | null {
  if (vol >= 9000 && vol <= 12000) return "NSW";
  if (vol >= 8000 && vol <= 9999) return "VIC";
  if (vol >= 1 && vol <= 3000 && fol < 500) return "QLD";
  return null;
}
