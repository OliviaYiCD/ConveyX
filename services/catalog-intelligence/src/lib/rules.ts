import type { Product, ProductType, PropertyContext } from "@conveyx/shared-types";
import { bodyCorpMatchesSuburb } from "./vic-mapping.js";

export interface RecommendOptions {
  includeBodyCorp?: boolean;
}

function lgaCouncilMatches(product: Product, context: PropertyContext): boolean {
  if (product.council === "ALL") return true;

  const councils = context.hints.lga_councils;
  if (councils?.length) {
    return councils.includes(product.council);
  }

  return context.council !== null && product.council === context.council;
}

function utilityCouncilMatches(product: Product, context: PropertyContext): boolean {
  if (product.council === "ALL") return true;

  const authorities = context.hints.water_authorities;
  if (authorities?.length) {
    return authorities.includes(product.council);
  }

  return context.council !== null && product.council === context.council;
}

function bodyCorpMatches(product: Product, context: PropertyContext, includeBodyCorp: boolean): boolean {
  if (!includeBodyCorp) return false;

  const suburb = context.hints.suburb;
  if (suburb) {
    return bodyCorpMatchesSuburb(product.product_name, suburb);
  }

  return product.council === "ALL" || (context.council !== null && product.council === context.council);
}

function vicProductMatches(
  product: Product,
  context: PropertyContext,
  includeBodyCorp: boolean
): boolean {
  switch (product.type as ProductType) {
    case "State_government":
      return product.council === "ALL";
    case "LGA":
      return lgaCouncilMatches(product, context);
    case "Utility":
      return utilityCouncilMatches(product, context);
    case "BodyCorp":
      return bodyCorpMatches(product, context, includeBodyCorp);
    case "LandInfo":
    case "Other":
      return false;
    default:
      return false;
  }
}

/** Type-specific product eligibility rules for address-based search. */
export function productMatchesSearchRules(
  product: Product,
  context: PropertyContext,
  options: RecommendOptions = {}
): boolean {
  if (!product.display_on_ui || product.status !== "active") return false;
  if (product.state !== context.state) return false;

  const includeBodyCorp = options.includeBodyCorp === true || context.hints.is_strata === true;

  if (context.state === "VIC" && context.hints.lga_councils?.length) {
    return vicProductMatches(product, context, includeBodyCorp);
  }

  const councilMatch =
    product.council === "ALL" ||
    (context.council !== null && product.council === context.council);

  switch (product.type as ProductType) {
    case "LGA":
      return councilMatch;
    case "State_government":
      return product.council === "ALL";
    case "BodyCorp":
      return includeBodyCorp && councilMatch;
    case "Other":
      return true;
    case "Utility":
      return councilMatch;
    case "LandInfo":
      return product.council === "ALL";
    default:
      return false;
  }
}

export function ruleReason(product: Product, context: PropertyContext): string {
  const suburb = context.hints.suburb;
  const councils = context.hints.lga_councils?.join(", ");
  const water = context.hints.water_provider ?? context.hints.water_authorities?.join(", ");

  switch (product.type) {
    case "LGA":
      return councils
        ? `LGA certificate for ${councils}`
        : `LGA product for ${context.council ?? context.state} suburb/council`;
    case "State_government":
      return `State-wide certificate for ${context.state}`;
    case "BodyCorp":
      return suburb
        ? `Owners corporation search for ${suburb}`
        : `Body corporate search for ${context.council ?? context.state}`;
    case "Utility":
      return water
        ? `Utility certificate from ${water}`
        : `Utility search for ${context.council ?? "suburb"} area`;
    case "LandInfo":
      return `LandInfo product for ${context.state}`;
    default:
      return `Other product for ${context.state}`;
  }
}

export { productMatchesCouncil, packageMatchesScope } from "./match.js";
