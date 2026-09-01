import type { AuState, PropertyContext } from "@conveyx/shared-types";
import {
  buildContext,
  detectStateFromText,
  detectStrataHints,
  normalizeWhitespace,
} from "./address.js";

/** Plan prefix → likely state (POC heuristic; production uses registry lookup). */
const PLAN_PREFIX_STATE: Record<string, AuState> = {
  DP: "NSW",
  SP: "NSW",
  CP: "NSW",
  PS: "VIC",
  LP: "VIC",
  RP: "QLD",
  BUP: "QLD",
  CT: "SA",
};

const PLAN_PATTERN = /\b(?:lot\s*)?(\d+)\s*(?:\/|\s+)(?:lot\s*)?(DP|SP|CP|PS|LP|RP|BUP|CT)\s*(\d+)\b/i;
const PLAN_ONLY_PATTERN = /\b(DP|SP|CP|PS|LP|RP|BUP|CT)\s*(\d+)\b/i;

export function resolveLotPlan(value: string): PropertyContext {
  const normalized = normalizeWhitespace(value);
  const hints = detectStrataHints(normalized);

  const match = normalized.match(PLAN_PATTERN) ?? normalized.match(PLAN_ONLY_PATTERN);
  if (!match) {
    throw new Error("Could not parse lot/plan identifier — expected format like 'Lot 1 DP 123456'");
  }

  const planType = match[2]!.toUpperCase();
  const planNumber = match[3]!;
  hints.plan_type = planType;
  if (["SP", "BUP", "CP"].includes(planType)) {
    hints.is_strata = true;
  }

  const prefixState = PLAN_PREFIX_STATE[planType];
  const textState = detectStateFromText(normalized);
  const state = textState ?? prefixState;

  if (!state) {
    throw new Error("Could not determine state from lot/plan identifier");
  }

  const normalizedIdentifier = match[1]
    ? `Lot ${match[1]} ${planType} ${planNumber}`
    : `${planType} ${planNumber}`;

  let confidence = textState ? 0.9 : 0.7;
  if (textState && prefixState && textState !== prefixState) {
    confidence = 0.6;
  }

  return buildContext("lot_plan", value, state, null, confidence, hints, normalizedIdentifier);
}
