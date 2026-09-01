import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Entity,
  EntitySettings,
  OrderDetail,
  OrderListItem,
  OrderStatus,
  RequiredDataField,
} from "@conveyx/shared-types";
import { api } from "../api/client";
import { PageHeader, Alert, Loading, EmptyState } from "../components/ui";
import { formatCurrency, orderStatusClass } from "../lib/constants";
import { fieldLabelMap, formatRequiredDataEntries } from "../lib/required-data";

const STATUSES: Array<OrderStatus | "all"> = [
  "all",
  "submitted",
  "pending_payment",
  "paid",
  "fulfilling",
  "completed",
  "draft",
  "cancelled",
  "failed",
];

function orderRef(id: string): string {
  return `ORD-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function buildOrdersQuery(params: {
  status: OrderStatus | "all";
  q: string;
  product: string;
  customer: string;
}): string {
  const search = new URLSearchParams();
  if (params.status !== "all") search.set("status", params.status);
  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.product.trim()) search.set("product", params.product.trim());
  if (params.customer.trim()) search.set("customer", params.customer.trim());
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function MetaGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return <p className="muted">No metadata.</p>;

  return (
    <div className="meta-grid">
      {entries.map(([key, value]) => (
        <div key={key} className="meta-item">
          <span className="meta-key">{key}</span>
          <span className="meta-value">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function OrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [fieldLibrary, setFieldLibrary] = useState<RequiredDataField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [entitySettings, setEntitySettings] = useState<EntitySettings | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQ, setSearchQ] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    q: "",
    customer: "",
    product: "",
    status: "all" as OrderStatus | "all",
  });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldLabels = useMemo(() => fieldLabelMap(fieldLibrary), [fieldLibrary]);
  const hasActiveFilters =
    appliedFilters.q !== "" ||
    appliedFilters.customer !== "" ||
    appliedFilters.product !== "" ||
    appliedFilters.status !== "all";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildOrdersQuery(appliedFilters);
      const [orderRows, fields] = await Promise.all([
        api.get<OrderListItem[]>(`/v1/orders${query}`),
        api.get<RequiredDataField[]>("/v1/required-data"),
      ]);
      setOrders(orderRows);
      setFieldLibrary(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    setAppliedFilters({
      q: searchQ,
      customer: customerFilter,
      product: productFilter,
      status: statusFilter,
    });
  }

  function clearFilters() {
    setSearchQ("");
    setCustomerFilter("");
    setProductFilter("");
    setStatusFilter("all");
    setAppliedFilters({ q: "", customer: "", product: "", status: "all" });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters();
  }

  async function viewOrder(orderId: string) {
    setSelectedId(orderId);
    setDetailLoading(true);
    setError(null);
    setEntity(null);
    setEntitySettings(null);

    try {
      const orderDetail = await api.get<OrderDetail>(`/v1/orders/${orderId}`);
      setDetail(orderDetail);

      const [ent, settings] = await Promise.all([
        api.get<Entity>(`/v1/entities/${orderDetail.order.entity_id}`).catch(() => null),
        api
          .get<EntitySettings>(`/v1/entities/${orderDetail.order.entity_id}/settings`)
          .catch(() => null),
      ]);
      setEntity(ent);
      setEntitySettings(settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load order detail");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Order fulfillment"
        description="Search orders by reference, customer, property, or product. View required data captured at checkout."
      />

      {error && <Alert type="error" message={error} />}

      <div className="card">
        <form className="orders-search" onSubmit={handleSearchSubmit}>
          <div className="orders-search-grid">
            <div className="field">
              <label htmlFor="order-search-q">Search</label>
              <input
                id="order-search-q"
                type="search"
                placeholder="Order ID, reference, property…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="order-search-customer">Customer</label>
              <input
                id="order-search-customer"
                type="search"
                placeholder="Customer name"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="order-search-product">Product</label>
              <input
                id="order-search-product"
                type="search"
                placeholder="Product name or SKU"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="order-search-status">Status</label>
              <select
                id="order-search-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All statuses" : s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="orders-search-actions">
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
            {hasActiveFilters && (
              <button type="button" className="btn btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={() => void load()}>
              Refresh
            </button>
            {!loading && (
              <span className="muted orders-search-count">
                {orders.length} order{orders.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </form>

        {loading ? (
          <Loading />
        ) : orders.length === 0 ? (
          <EmptyState
            message={
              hasActiveFilters
                ? "No orders match your search. Try different filters."
                : "No orders found."
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Property</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={selectedId === o.id ? "row-selected" : undefined}>
                    <td>
                      <code>{orderRef(o.id)}</code>
                    </td>
                    <td>{o.customer_name ?? o.entity_id.slice(0, 8) + "…"}</td>
                    <td>{o.property_address}</td>
                    <td className="muted products-cell">
                      {o.product_names?.length ? o.product_names.join(", ") : "—"}
                    </td>
                    <td>
                      <span className={orderStatusClass(o.status)}>{o.status}</span>
                    </td>
                    <td>{formatCurrency(Number(o.total))}</td>
                    <td className="muted">{new Date(o.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => void viewOrder(o.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId && (
        <div className="card">
          {detailLoading || !detail ? (
            <Loading label="Loading order detail…" />
          ) : (
            <>
              <div className="detail-header">
                <div>
                  <h3 style={{ margin: 0 }}>{orderRef(detail.order.id)}</h3>
                  <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                    {detail.order.property_address}
                  </p>
                </div>
                <span className={orderStatusClass(detail.order.status)}>{detail.order.status}</span>
              </div>

              <div className="detail-grid">
                <section>
                  <h4>Customer</h4>
                  {entity ? (
                    <dl className="detail-dl">
                      <dt>Name</dt>
                      <dd>{entity.name}</dd>
                      <dt>Entity type</dt>
                      <dd>{entity.entity_type}</dd>
                      <dt>ABN</dt>
                      <dd>{entity.abn ?? "—"}</dd>
                      <dt>Status</dt>
                      <dd>{entity.status}</dd>
                      {entitySettings && (
                        <>
                          <dt>Billing</dt>
                          <dd>{entitySettings.billing_preference}</dd>
                          <dt>Invoice email</dt>
                          <dd>{entitySettings.invoice_email ?? "—"}</dd>
                        </>
                      )}
                    </dl>
                  ) : (
                    <p className="muted">
                      Entity <code>{detail.order.entity_id}</code>
                    </p>
                  )}
                </section>

                <section>
                  <h4>Property context</h4>
                  <MetaGrid data={detail.order.property_context as unknown as Record<string, unknown>} />
                  {detail.order.include_body_corp && (
                    <p className="badge badge-active" style={{ marginTop: "0.75rem" }}>
                      Body corporate included
                    </p>
                  )}
                </section>

                <section>
                  <h4>Order totals</h4>
                  <dl className="detail-dl">
                    <dt>Subtotal</dt>
                    <dd>{formatCurrency(Number(detail.order.subtotal))}</dd>
                    <dt>GST</dt>
                    <dd>{formatCurrency(Number(detail.order.gst_total))}</dd>
                    <dt>Total</dt>
                    <dd>
                      <strong>{formatCurrency(Number(detail.order.total))}</strong>
                    </dd>
                    <dt>Created</dt>
                    <dd>{new Date(detail.order.created_at).toLocaleString()}</dd>
                  </dl>
                </section>
              </div>

              <h4 style={{ marginTop: "1.5rem" }}>Line items &amp; required data</h4>
              {detail.lines.length === 0 ? (
                <p className="muted">No line items.</p>
              ) : (
                detail.lines.map((line) => {
                  const buyerFields = formatRequiredDataEntries(line.required_data_buyer, fieldLabels);
                  const sellerFields = formatRequiredDataEntries(line.required_data_seller, fieldLabels);
                  const hasRequired = buyerFields.length > 0 || sellerFields.length > 0;

                  return (
                    <div key={line.id} className="line-detail">
                      <div className="line-detail-head">
                        <div>
                          <strong>{line.product_name}</strong>
                          <span className="muted">
                            {" "}
                            · {line.sku} · {line.product_type}
                          </span>
                        </div>
                        <span>{formatCurrency(Number(line.line_total))}</span>
                      </div>

                      {hasRequired ? (
                        <div className="required-data-display">
                          {buyerFields.length > 0 && (
                            <div>
                              <h5>Buyer data</h5>
                              <dl className="detail-dl compact">
                                {buyerFields.map((f) => (
                                  <div key={f.key} className="detail-dl-row">
                                    <dt>{f.label}</dt>
                                    <dd>{f.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          )}
                          {sellerFields.length > 0 && (
                            <div>
                              <h5>Seller data</h5>
                              <dl className="detail-dl compact">
                                {sellerFields.map((f) => (
                                  <div key={f.key} className="detail-dl-row">
                                    <dt>{f.label}</dt>
                                    <dd>{f.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
                          No required data fields for this product.
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
