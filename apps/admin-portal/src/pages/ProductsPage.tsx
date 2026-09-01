import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AuState, Product, ProductStatus, ProductType } from "@conveyx/shared-types";
import { api } from "../api/client";
import { PageHeader, Alert, Loading, EmptyState } from "../components/ui";
import {
  AU_STATES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  PROVIDER_TYPE_LABELS,
  formatCurrency,
  statusClass,
} from "../lib/constants";

const PAGE_SIZE = 50;

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [stateFilter, setStateFilter] = useState<AuState | "">("");
  const [typeFilter, setTypeFilter] = useState<ProductType | "">("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "">("");
  const [applied, setApplied] = useState({
    search: "",
    state: "" as AuState | "",
    type: "" as ProductType | "",
    status: "" as ProductStatus | "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (applied.search) params.set("search", applied.search);
      if (applied.state) params.set("state", applied.state);
      if (applied.type) params.set("type", applied.type);
      if (applied.status) params.set("status", applied.status);
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      const { items, meta } = await api.getList<Product>(`/v1/products?${params.toString()}`);
      setProducts(items);
      setTotal(meta.total ?? items.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    setPage(1);
    setApplied({
      search: searchInput.trim(),
      state: stateFilter,
      type: typeFilter,
      status: statusFilter,
    });
  }

  function clearFilters() {
    setSearchInput("");
    setStateFilter("");
    setTypeFilter("");
    setStatusFilter("");
    setPage(1);
    setApplied({ search: "", state: "", type: "", status: "" });
  }

  return (
    <>
      <PageHeader
        title="Products"
        description="Search, filter, and edit SKUs in the catalog."
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link to="/import" className="btn">
              Bulk import
            </Link>
            <Link to="/products/new" className="btn btn-primary">
              + Add product
            </Link>
          </div>
        }
      />

      {error && <Alert type="error" message={error} />}

      <div className="card">
        <form
          className="orders-search"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
        >
          <div className="orders-search-grid">
            <div className="field">
              <label htmlFor="product-search">Search</label>
              <input
                id="product-search"
                type="search"
                placeholder="Name, SKU, council, description, ID…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="product-state">State</label>
              <select
                id="product-state"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value as AuState | "")}
              >
                <option value="">All states</option>
                {AU_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="product-type">Type</label>
              <select
                id="product-type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ProductType | "")}
              >
                <option value="">All types</option>
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROVIDER_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="product-status">Status</label>
              <select
                id="product-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ProductStatus | "")}
              >
                <option value="">All statuses</option>
                {PRODUCT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="orders-search-actions">
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
            <button type="button" className="btn btn-sm" onClick={clearFilters}>
              Clear filters
            </button>
            <button type="button" className="btn btn-sm" onClick={() => void load()}>
              Refresh
            </button>
            {!loading && (
              <span className="muted orders-search-count">
                {total} product{total === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </form>

        {loading ? (
          <Loading />
        ) : products.length === 0 ? (
          <EmptyState message="No products match your filters." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>State</th>
                    <th>Type</th>
                    <th>Council</th>
                    <th>Retail</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <code>{p.sku}</code>
                      </td>
                      <td>{p.product_name}</td>
                      <td>{p.state}</td>
                      <td>{PROVIDER_TYPE_LABELS[p.type] ?? p.type}</td>
                      <td>{p.council}</td>
                      <td>{formatCurrency(Number(p.retail_price))}</td>
                      <td>
                        <span className={statusClass(p.status)}>{p.status}</span>
                      </td>
                      <td>
                        <Link to={`/products/${p.id}/edit`} className="btn btn-sm">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                type="button"
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
