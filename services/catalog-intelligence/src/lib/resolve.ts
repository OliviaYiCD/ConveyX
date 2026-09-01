import type { PropertyContext, PropertyIdentifierRequest } from "@conveyx/shared-types";
import { resolveAddress } from "./resolvers/address.js";
import { resolveLotPlan } from "./resolvers/lot-plan.js";
import { resolveTitleReference } from "./resolvers/title-reference.js";
import { resolveVolFol } from "./resolvers/vol-fol.js";

const VALID_TYPES = new Set<PropertyIdentifierRequest["identifier_type"]>([
  "title_reference",
  "vol_fol",
  "lot_plan",
  "address",
]);

export function validateIdentifierRequest(input: PropertyIdentifierRequest): string | null {
  if (!input.identifier_type || !VALID_TYPES.has(input.identifier_type)) {
    return "identifier_type must be one of: title_reference, vol_fol, lot_plan, address";
  }
  if (!input.value || typeof input.value !== "string" || input.value.trim().length === 0) {
    return "value is required and must be a non-empty string";
  }
  return null;
}

export function resolvePropertyIdentifier(input: PropertyIdentifierRequest): PropertyContext {
  switch (input.identifier_type) {
    case "address":
      return resolveAddress(input.value);
    case "lot_plan":
      return resolveLotPlan(input.value);
    case "title_reference":
      return resolveTitleReference(input.value);
    case "vol_fol":
      return resolveVolFol(input.value);
  }
}
