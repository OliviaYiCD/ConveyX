import { useEffect, useState } from "react";
import type { Order } from "@conveyx/shared-types";
import { api, DEMO_ENTITY_ID, formatCurrency } from "../api/client";
import { orderReference } from "../lib/order-detail";
import { Alert, ButtonLink, Card, EmptyState, Loading } from "../components/ui";

function statusClass(status: string): string {
  return `order-status order-status-${status.replace(/_/g, "-")}`;
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .get<Order[]>(`/v1/orders?entity_id=${DEMO_ENTITY_ID}`)
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="orders-header">
        <h1>My orders</h1>
        <ButtonLink to="/" variant="primary">
          New search
        </ButtonLink>
      </div>

      {error && <Alert type="error" message={error} />}

      <Card padding="none">
        {loading ? (
          <Loading label="Loading your orders…" />
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            description="Search for a property and place your first order to see it here."
            action={
              <ButtonLink to="/" variant="primary">
                Start a search
              </ButtonLink>
            }
          />
        ) : (
          orders.map((o) => (
            <div key={o.id} className="order-row">
              <div className="order-row-meta">
                <strong>{o.property_address}</strong>
                <span>
                  {orderReference(o.id)} · {new Date(o.created_at).toLocaleString()}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="product-price" style={{ marginBottom: "0.35rem" }}>
                  {formatCurrency(Number(o.total))}
                </div>
                <span className={statusClass(o.status)}>{o.status.replace(/_/g, " ")}</span>
              </div>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
