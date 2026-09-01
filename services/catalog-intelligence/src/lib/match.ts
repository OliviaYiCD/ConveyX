import type { Package, Product, PropertyContext } from "@conveyx/shared-types";

function contextCouncilNames(context: PropertyContext): string[] {
  if (context.hints.lga_councils?.length) {
    return context.hints.lga_councils;
  }
  if (context.council) {
    return [context.council];
  }
  return [];
}

export function productMatchesCouncil(product: Product, context: PropertyContext): boolean {
  if (product.council === "ALL") return true;

  const councils = contextCouncilNames(context);
  if (councils.length) {
    return councils.includes(product.council);
  }

  return false;
}

export function packageMatchesScope(pkg: Package, context: PropertyContext): boolean {
  switch (pkg.scope_type) {
    case "global":
      return true;
    case "state":
      return pkg.scope_state === context.state;
    case "council": {
      if (pkg.scope_state !== context.state) return false;
      if (pkg.scope_council === "ALL") return true;

      const councils = contextCouncilNames(context);
      if (councils.length) {
        return councils.includes(pkg.scope_council ?? "");
      }

      return context.council === pkg.scope_council;
    }
    default:
      return false;
  }
}
