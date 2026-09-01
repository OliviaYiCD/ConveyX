import { useEffect, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import type { OrderDetail } from "@conveyx/shared-types";
import { api, formatCurrency } from "../api/client";
import { normalizeOrderDetail, orderReference } from "../lib/order-detail";
import { Badge, ButtonLink, Card, Loading } from "../components/ui";

type LocationState = { order?: OrderDetail };

function loadCachedOrder(orderId: string): OrderDetail | null {
  const raw = sessionStorage.getItem("cx_order");
  if (!raw) return null;
  try {
    const detail = normalizeOrderDetail(JSON.parse(raw));
    if (detail?.order.id === orderId) return detail;
  } catch {
    /* ignore */
  }
  return null;
}

export function ConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [detail, setDetail] = useState<OrderDetail | null>(
    () => state?.order ?? (orderId ? loadCachedOrder(orderId) : null)
  );
  const [loading, setLoading] = useState(!detail && !!orderId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || detail) return;

    let cancelled = false;
    void api
      .get<OrderDetail>(`/v1/orders/${orderId}`)
      .then((data) => {
        if (cancelled) return;
        const normalized = normalizeOrderDetail(data);
        if (!normalized) {
          setError("Could not load order details.");
          return;
        }
        setDetail(normalized);
        sessionStorage.setItem("cx_order", JSON.stringify(normalized));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load order");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, detail]);

  if (!orderId) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <Card>
        <Loading label="Loading your order…" />
      </Card>
    );
  }

  if (error || !detail) {
    return (
      <Card>
        <div className="alert alert-error" role="alert">
          {error ?? "Order not found."}
        </div>
        <ButtonLink to="/orders" variant="primary">
          View my orders
        </ButtonLink>
      </Card>
    );
  }

  const { order, lines } = detail;
  const ref = orderReference(order.id);

  return (
    <>
      <div className="confirmation-hero">
        <div className="confirmation-icon" aria-hidden>
          ✓
        </div>
        <h1>Order placed successfully</h1>
        <p>
          Your order has been submitted. We&apos;ll invoice your account — no payment required at
          checkout.
        </p>
      </div>

      <Card>
        <div className="confirmation-meta">
          <div>
            <span className="meta-label">Order reference</span>
            <strong style={{ fontSize: "1.05rem" }}>{ref}</strong>
          </div>
          <div>
            <span className="meta-label">Status</span>
            <div>
              <Badge variant="success">{order.status}</Badge>
            </div>
          </div>
        </div>

        <p className="confirmation-address">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {order.property_address}
        </p>

        <h3 className="section-title">Order summary</h3>

        {lines.length === 0 ? (
          <p className="muted-inline">No line items recorded.</p>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="product-item" style={{ cursor: "default" }}>
              <div className="product-meta">
                <strong>{line.product_name}</strong>
                <span>
                  {line.sku} · Qty {line.quantity}
                </span>
              </div>
              <div className="product-price">{formatCurrency(Number(line.line_total))}</div>
            </div>
          ))
        )}

        <div style={{ marginTop: "1rem" }}>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatCurrency(Number(order.subtotal))}</span>
          </div>
          <div className="summary-row">
            <span>GST</span>
            <span>{formatCurrency(Number(order.gst_total))}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatCurrency(Number(order.total))}</span>
          </div>
        </div>
      </Card>

      <div className="page-actions">
        <ButtonLink to="/" variant="primary">
          New property search
        </ButtonLink>
        <ButtonLink to="/orders">View all orders</ButtonLink>
      </div>
    </>
  );
}
