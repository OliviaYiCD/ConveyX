import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { Product, ProductType, RecommendationResponse } from "@conveyx/shared-types";
import { formatCurrency } from "../api/client";
import { groupProducts } from "../lib/product-groups";
import { Badge, ButtonLink, Card, EmptyState, Modal, StickyBar } from "../components/ui";

const COLLAPSED_BY_DEFAULT: ProductType[] = [
  "State_government",
  "Utility",
  "BodyCorp",
  "LandInfo",
  "Other",
];

function loadSearch(): {
  address: string;
  includeBodyCorp: boolean;
  recommendations: RecommendationResponse;
} | null {
  const raw = sessionStorage.getItem("cx_search");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      address: string;
      includeBodyCorp: boolean;
      recommendations: RecommendationResponse;
    };
  } catch {
    return null;
  }
}

function formatPrice(price: number): { text: string; free: boolean } {
  if (!price || price <= 0) return { text: "Price on request", free: true };
  return { text: formatCurrency(price), free: false };
}

function productMatchesQuery(product: Product, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [product.product_name, product.sku, product.description ?? ""]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`group-chevron ${expanded ? "group-chevron-expanded" : ""}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function initialExpandedGroups(products: RecommendationResponse["products"]): Set<ProductType> {
  const types = groupProducts(products).map((g) => g.type);
  return new Set(types.filter((type) => !COLLAPSED_BY_DEFAULT.includes(type)));
}

export function ResultsPage() {
  const navigate = useNavigate();
  const search = useMemo(() => loadSearch(), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<ProductType>>(() =>
    search ? initialExpandedGroups(search.recommendations.products) : new Set()
  );
  const [descriptionProduct, setDescriptionProduct] = useState<Product | null>(null);
  const [productQuery, setProductQuery] = useState("");

  const groups = useMemo(
    () => (search ? groupProducts(search.recommendations.products) : []),
    [search]
  );

  const query = productQuery.trim();
  const filteredGroups = useMemo(() => {
    if (!query) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(({ product }) => productMatchesQuery(product, query)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  const totalFiltered = filteredGroups.reduce((sum, g) => sum + g.items.length, 0);
  const totalProducts = groups.reduce((sum, g) => sum + g.items.length, 0);

  useEffect(() => {
    if (!descriptionProduct) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDescriptionProduct(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [descriptionProduct]);

  if (!search) return <Navigate to="/" replace />;

  const { recommendations, address } = search;
  const ctx = recommendations.context;

  const selectedProducts = recommendations.products.filter((p) =>
    selected.has(p.product.id)
  );
  const cartTotal = selectedProducts.reduce(
    (s, p) => s + Number(p.product.retail_price),
    0
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectGroup(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }

  function clearGroup(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  function toggleGroup(type: ProductType) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function continueToCheckout() {
    if (!search) return;
    const products = recommendations.products
      .filter((p) => selected.has(p.product.id))
      .map((p) => p.product);
    sessionStorage.setItem(
      "cx_cart",
      JSON.stringify({
        address,
        products,
        context: ctx,
        includeBodyCorp: search.includeBodyCorp,
      })
    );
    navigate("/checkout");
  }

  return (
    <>
      <Card padding="none">
        <div className="context-bar">
          <div className="context-bar-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="context-bar-text">
            <strong>{address}</strong>
            <span>
              {ctx.state}
              {ctx.council ? ` · ${ctx.council}` : ""}
              {search.includeBodyCorp ? " · Body corp included" : ""}
            </span>
          </div>
        </div>
        <div style={{ padding: "1rem 1.25rem" }}>
          <div className="context-badge">
            <Badge>State: {ctx.state}</Badge>
            {ctx.council && <Badge variant="muted">Council: {ctx.council}</Badge>}
            {search.includeBodyCorp && <Badge>Body corp</Badge>}
          </div>
        </div>
      </Card>

      {groups.length > 0 && (
        <div className="results-search">
          <div className="results-search-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <input
            type="search"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Search certificates by name…"
            aria-label="Search certificates"
          />
          {productQuery && (
            <button
              type="button"
              className="results-search-clear"
              onClick={() => setProductQuery("")}
              aria-label="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {query && groups.length > 0 && (
        <p className="results-search-meta">
          {totalFiltered === 0
            ? "No certificates match your search"
            : `Showing ${totalFiltered} of ${totalProducts} certificate${totalProducts === 1 ? "" : "s"}`}
        </p>
      )}

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title="No products matched"
            description="Try a different address or enable body corporate if this is a strata property."
            action={
              <ButtonLink to="/" variant="primary">
                Back to search
              </ButtonLink>
            }
          />
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <EmptyState
            title="No certificates found"
            description={`No results for "${query}". Try a different search term.`}
            action={
              <button type="button" className="btn btn-secondary" onClick={() => setProductQuery("")}>
                Clear search
              </button>
            }
          />
        </Card>
      ) : (
        filteredGroups.map((group) => {
          const ids = group.items.map((i) => i.product.id);
          const allSelected = ids.every((id) => selected.has(id));
          const isExpanded = query ? true : expandedGroups.has(group.type);
          const selectedInGroup = ids.filter((id) => selected.has(id)).length;

          return (
            <Card key={group.type} padding="none" className="product-group">
              <div className="product-group-header">
                <button
                  type="button"
                  className="product-group-toggle"
                  onClick={() => toggleGroup(group.type)}
                  aria-expanded={isExpanded}
                >
                  <Chevron expanded={isExpanded} />
                  <h3>{group.label}</h3>
                  <span className="product-group-count">{group.items.length}</span>
                  {selectedInGroup > 0 && (
                    <span className="product-group-selected">{selectedInGroup} selected</span>
                  )}
                </button>
                <div className="group-actions">
                  {!allSelected && (
                    <button type="button" onClick={() => selectGroup(ids)}>
                      Select all
                    </button>
                  )}
                  {ids.some((id) => selected.has(id)) && (
                    <button type="button" onClick={() => clearGroup(ids)}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {isExpanded &&
                group.items.map(({ product }) => {
                  const isSelected = selected.has(product.id);
                  const price = formatPrice(Number(product.retail_price));
                  return (
                    <div
                      key={product.id}
                      className={`product-item ${isSelected ? "product-item-selected" : ""}`}
                    >
                      <label className="product-item-label">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(product.id)}
                        />
                        <div className="product-meta">
                          <strong>{product.product_name}</strong>
                        </div>
                        <div className={`product-price ${price.free ? "product-price-free" : ""}`}>
                          {price.text}
                        </div>
                      </label>
                      <button
                        type="button"
                        className="product-details-btn"
                        aria-label={`View description for ${product.product_name}`}
                        onClick={() => setDescriptionProduct(product)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        Details
                      </button>
                    </div>
                  );
                })}
            </Card>
          );
        })
      )}

      <Modal
        open={descriptionProduct !== null}
        title={descriptionProduct?.product_name ?? "Certificate details"}
        onClose={() => setDescriptionProduct(null)}
      >
        {descriptionProduct?.description?.trim() ? (
          <p className="modal-description">{descriptionProduct.description}</p>
        ) : (
          <p className="modal-description muted-inline">No description available for this certificate.</p>
        )}
      </Modal>

      {selected.size > 0 && (
        <StickyBar>
          <div className="sticky-bar-inner">
            <div className="sticky-bar-summary">
              <span className="muted-inline">
                {selected.size} product{selected.size === 1 ? "" : "s"} selected
              </span>
              <br />
              <strong>{cartTotal > 0 ? formatCurrency(cartTotal) : "Review pricing at checkout"}</strong>
            </div>
            <div className="sticky-bar-actions">
              <ButtonLink to="/" variant="ghost">
                Back
              </ButtonLink>
              <button type="button" className="btn btn-primary btn-lg" onClick={continueToCheckout}>
                Review order
              </button>
            </div>
          </div>
        </StickyBar>
      )}

      {selected.size === 0 && groups.length > 0 && (
        <div className="page-actions">
          <ButtonLink to="/">Back to search</ButtonLink>
        </div>
      )}
    </>
  );
}
