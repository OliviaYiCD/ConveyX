import type { AuState, PropertyContext } from "@conveyx/shared-types";
import {
  buildContext,
  detectStateFromText,
  detectStrataHints,
  normalizeWhitespace,
} from "./address.js";

/** State-specific title reference patterns (POC). */
const TITLE_PATTERNS: { state: AuState; pattern: RegExp; confidence: number }[] = [
  { state: "NSW", pattern: /^\d+\/\d{5,8}$/, confidence: 0.85 },
  { state: "NSW", pattern: /^[A-Z]{2,4}\s*\d{4,10}$/i, confidence: 0.8 },
  { state: "VIC", pattern: /^[A-Z]{2}\d{6,10}$/i, confidence: 0.8 },
  { state: "QLD", pattern: /^\d{5,7}$/, confidence: 0.65 },
  { state: "SA", pattern: /^CT\s*\d+/i, confidence: 0.85 },
  { state: "WA", pattern: /^[A-Z]{2,3}\d{4,8}$/i, confidence: 0.75 },
];

export function resolveTitleReference(value: string): PropertyContext {
  const normalized = normalizeWhitespace(value);
  const hints = detectStrataHints(normalized);

  const explicitState = detectStateFromText(normalized);
  if (explicitState) {
    return buildContext("title_reference", value, explicitState, null, 0.9, hints);
  }

  for (const { state, pattern, confidence } of TITLE_PATTERNS) {
    if (pattern.test(normalized)) {
      return buildContext("title_reference", value, state, null, confidence, hints);
    }
  }

  if (/^\d+\/\d+$/.test(normalized)) {
    return buildContext("title_reference", value, "NSW", null, 0.7, hints);
  }

  throw new Error("Could not determine state from title reference — include state prefix if ambiguous");
}
