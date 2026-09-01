import type {
  Product,
  PropertyContext,
  RecommendedPackage,
  RecommendedProduct,
  RecommendationResponse,
} from "@conveyx/shared-types";
import type { SkuClient } from "./sku-client.js";
import { packageMatchesScope } from "./match.js";
import { productMatchesSearchRules, ruleReason } from "./rules.js";

const TYPE_DISPLAY_ORDER: Product["type"][] = [
  "LGA",
  "LandInfo",
  "State_government",
  "BodyCorp",
  "Utility",
  "Other",
];

function typeSortRank(type: Product["type"]): number {
  const idx = TYPE_DISPLAY_ORDER.indexOf(type);
  return idx >= 0 ? idx : TYPE_DISPLAY_ORDER.length;
}

function packageScore(scopeType: string): number {
  switch (scopeType) {
    case "council":
      return 0;
    case "state":
      return 10;
    case "global":
      return 20;
    default:
      return 30;
  }
}

export async function buildRecommendations(
  skuClient: SkuClient,
  context: PropertyContext,
  requestId?: string,
  options: { includeBodyCorp?: boolean } = {}
): Promise<RecommendationResponse> {
  const allProducts = await skuClient.listProducts(
    { state: context.state, display_on_ui: true, status: "active" },
    requestId
  );

  const matchingProducts = allProducts.filter((p) =>
    productMatchesSearchRules(p, context, { includeBodyCorp: options.includeBodyCorp })
  );

  const [globalPkgs, statePkgs, councilPkgs] = await Promise.all([
    skuClient.listPackages({ scope_type: "global", display_on_ui: true, status: "active" }, requestId),
    skuClient.listPackages(
      { scope_type: "state", scope_state: context.state, display_on_ui: true, status: "active" },
      requestId
    ),
    skuClient.listPackages(
      { scope_type: "council", scope_state: context.state, display_on_ui: true, status: "active" },
      requestId
    ),
  ]);

  const allPackages = [...globalPkgs, ...statePkgs, ...councilPkgs].filter((pkg) =>
    packageMatchesScope(pkg, context)
  );

  const seenPackageIds = new Set<string>();
  const uniquePackages = allPackages.filter((pkg) => {
    if (seenPackageIds.has(pkg.id)) return false;
    seenPackageIds.add(pkg.id);
    return true;
  });

  const packageDetails = await Promise.all(
    uniquePackages.map(async (pkg) => {
      const detail = await skuClient.getPackage(pkg.id, requestId);
      const products = detail.items
        .map((item) => item.product)
        .filter(
          (p): p is Product =>
            p !== undefined && productMatchesSearchRules(p, context, { includeBodyCorp: options.includeBodyCorp })
        );
      return { pkg, products };
    })
  );

  const packagesInScope = packageDetails.filter(({ products }) => products.length > 0);

  const productIdsInPackages = new Set<string>();
  for (const { products } of packagesInScope) {
    for (const p of products) productIdsInPackages.add(p.id);
  }

  const recommendedPackages: RecommendedPackage[] = packagesInScope
    .map(({ pkg, products }) => ({
      package: pkg,
      products,
      rank: packageScore(pkg.scope_type),
      reason: `${pkg.scope_type} package for ${context.state}${context.council ? ` / ${context.council}` : ""}`,
    }))
    .sort((a, b) => a.rank - b.rank || a.package.package_name.localeCompare(b.package.package_name));

  const addonProducts = matchingProducts.filter((p) => !productIdsInPackages.has(p.id));

  const recommendedProducts: RecommendedProduct[] = addonProducts
    .map((product, idx) => ({
      product,
      rank: typeSortRank(product.type) * 10 + idx,
      reason: ruleReason(product, context),
    }))
    .sort(
      (a, b) =>
        typeSortRank(a.product.type) - typeSortRank(b.product.type) ||
        a.product.product_name.localeCompare(b.product.product_name)
    );

  return { context, packages: recommendedPackages, products: recommendedProducts };
}

export { TYPE_DISPLAY_ORDER };
