import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { OrderDetail, Product, PropertyContext, RequiredDataField } from "@conveyx/shared-types";
import { api, DEMO_ENTITY_ID, formatCurrency } from "../api/client";
import { getSession } from "../lib/session";
import { normalizeOrderDetail } from "../lib/order-detail";
import {
  applySharedFieldUpdate,
  cartNeedsRequiredData,
  emptyCartRequiredData,
  getSharedFieldValue,
  inputType,
  normalizeCartRequiredData,
  uniqueCartRequiredFields,
  productsWithRequiredData,
  validateCartRequiredData,
  type CartRequiredData,
} from "../lib/required-data";
import { Alert, ButtonLink, Card, Loading } from "../components/ui";

interface CartData {
  address: string;
  products: Product[];
  context: PropertyContext;
  includeBodyCorp: boolean;
  requiredData?: CartRequiredData;
}

function loadCart(): CartData | null {
  const raw = sessionStorage.getItem("cx_cart");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CartData;
  } catch {
    return null;
  }
}

function saveCart(cart: CartData) {
  sessionStorage.setItem("cx_cart", JSON.stringify(cart));
}

function estimateGst(price: number): number {
  return Math.round(price * 0.1 * 100) / 100;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(() => loadCart());
  const [fieldLibrary, setFieldLibrary] = useState<RequiredDataField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .get<RequiredDataField[]>("/v1/required-data")
      .then((fields) => {
        setFieldLibrary(fields);
        setCart((prev) => {
          if (!prev) return prev;
          if (!cartNeedsRequiredData(prev.products, fields)) return prev;
          const requiredData = prev.requiredData
            ? normalizeCartRequiredData(prev.products, fields, prev.requiredData, prev.address)
            : emptyCartRequiredData(prev.products, fields, prev.address);
          const next = { ...prev, requiredData };
          saveCart(next);
          return next;
        });
      })
      .catch(() => setFieldLibrary([]))
      .finally(() => setFieldsLoading(false));
  }, []);

  if (!cart) return <Navigate to="/" replace />;

  const session = getSession();
  const entityId = session.entityId ?? DEMO_ENTITY_ID;
  const isGuest = session.mode === "guest";
  const needsRequiredData = cartNeedsRequiredData(cart.products, fieldLibrary);
  const subtotal = cart.products.reduce((s, p) => s + Number(p.retail_price), 0);
  const gst = cart.products.reduce((s, p) => {
    if (p.gst_option === "no_gst") return s;
    return s + estimateGst(Number(p.retail_price));
  }, 0);
  const total = subtotal + gst;

  const buyerFields = uniqueCartRequiredFields(cart.products, fieldLibrary, "buyer");
  const sellerFields = uniqueCartRequiredFields(cart.products, fieldLibrary, "seller");
  const productsNeedingData = productsWithRequiredData(cart.products, fieldLibrary);

  function updateSharedField(side: "buyer" | "seller", fieldKey: string, value: string) {
    setCart((prev) => {
      if (!prev?.requiredData) return prev;
      const requiredData = applySharedFieldUpdate(
        prev.products,
        fieldLibrary,
        prev.requiredData,
        side,
        fieldKey,
        value
      );
      const next: CartData = { ...prev, requiredData };
      saveCart(next);
      return next;
    });
  }

  async function placeOrder() {
    if (!cart) return;

    if (needsRequiredData && cart.requiredData) {
      const validationError = validateCartRequiredData(cart.products, fieldLibrary, cart.requiredData);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const createdRaw = await api.post<OrderDetail>("/v1/orders", {
        entity_id: entityId,
        property_address: cart.address,
        property_context: cart.context,
        include_body_corp: cart.includeBodyCorp,
        lines: cart.products.map((p) => ({
          product_id: p.id,
          required_data_buyer: cart.requiredData?.[p.id]?.buyer ?? {},
          required_data_seller: cart.requiredData?.[p.id]?.seller ?? {},
        })),
      });
      const created = normalizeOrderDetail(createdRaw);
      if (!created?.order.id) throw new Error("Unexpected response from order service");

      const submittedRaw = await api.post<OrderDetail>(
        `/v1/orders/${created.order.id}/submit`,
        {}
      );
      const submitted = normalizeOrderDetail(submittedRaw);
      if (!submitted?.order.id) throw new Error("Order was created but could not be submitted");

      sessionStorage.setItem("cx_order", JSON.stringify(submitted));
      sessionStorage.removeItem("cx_cart");
      navigate(`/confirmation/${submitted.order.id}`, { state: { order: submitted }, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setLoading(false);
    }
  }

  const summaryBlock = (
    <div className="order-summary-card">
      <h3>Order summary</h3>
      <p className="muted-inline" style={{ margin: "0 0 1rem" }}>
        {cart.address}
      </p>

      {cart.products.map((p) => (
        <div key={p.id} className="product-item" style={{ padding: "0.65rem 0", cursor: "default" }}>
          <div className="product-meta">
            <strong>{p.product_name}</strong>
            <span>{p.sku}</span>
          </div>
          <div className="product-price">
            {Number(p.retail_price) > 0 ? formatCurrency(Number(p.retail_price)) : "—"}
          </div>
        </div>
      ))}

      <div style={{ marginTop: "0.75rem" }}>
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="summary-row">
          <span>GST</span>
          <span>{formatCurrency(gst)}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className={`billing-mode ${isGuest ? "billing-mode-guest" : "billing-mode-account"}`}>
        <strong>{isGuest ? "Pay per check" : "Account order"}</strong>
        <span>
          {isGuest
            ? "Guest checkout — card payment would be collected here (POC: submit without payment)."
            : `Invoiced to ${session.name ?? session.email ?? "your firm account"}.`}
        </span>
      </div>

      <p className="summary-note">
        {isGuest
          ? "One-off order. Sign in for account invoicing and order history."
          : "This order will be added to your monthly firm invoice."}
      </p>

      <button
        type="button"
        className="btn btn-primary btn-lg summary-cta"
        disabled={loading || fieldsLoading}
        onClick={() => void placeOrder()}
      >
        {loading ? "Placing order…" : "Place order"}
      </button>
    </div>
  );

  return (
    <div className="checkout-layout">
      <div className="checkout-main">
        {needsRequiredData && (
          <Card>
            <h2>Required information</h2>
            <p className="lead">
              These products need additional details before we can fulfil your order.
            </p>

            {fieldsLoading ? (
              <Loading label="Loading form fields…" />
            ) : (
              <>
                <p className="muted-inline required-data-applies">
                  Applies to {productsNeedingData.length} product
                  {productsNeedingData.length === 1 ? "" : "s"} in your order.
                </p>

                {buyerFields.length > 0 && (
                  <div className="required-data-side">
                    <h4>Buyer</h4>
                    {buyerFields.map((field) => (
                      <div key={field.field_key} className="field">
                        <label htmlFor={`shared-b-${field.field_key}`}>{field.field_name}</label>
                        <input
                          id={`shared-b-${field.field_key}`}
                          type={inputType(field.field_type)}
                          value={
                            cart.requiredData
                              ? getSharedFieldValue(
                                  cart.products,
                                  fieldLibrary,
                                  cart.requiredData,
                                  "buyer",
                                  field.field_key
                                )
                              : ""
                          }
                          placeholder={
                            typeof field.metadata?.placeholder === "string"
                              ? field.metadata.placeholder
                              : undefined
                          }
                          onChange={(e) =>
                            updateSharedField("buyer", field.field_key, e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                {sellerFields.length > 0 && (
                  <div className="required-data-side">
                    <h4>Seller</h4>
                    {sellerFields.map((field) => (
                      <div key={field.field_key} className="field">
                        <label htmlFor={`shared-s-${field.field_key}`}>{field.field_name}</label>
                        <input
                          id={`shared-s-${field.field_key}`}
                          type={inputType(field.field_type)}
                          value={
                            cart.requiredData
                              ? getSharedFieldValue(
                                  cart.products,
                                  fieldLibrary,
                                  cart.requiredData,
                                  "seller",
                                  field.field_key
                                )
                              : ""
                          }
                          placeholder={
                            typeof field.metadata?.placeholder === "string"
                              ? field.metadata.placeholder
                              : undefined
                          }
                          onChange={(e) =>
                            updateSharedField("seller", field.field_key, e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        <div className="page-actions">
          <ButtonLink to="/results">Back to products</ButtonLink>
        </div>
      </div>

      <aside className="checkout-sidebar">
        {error && !needsRequiredData && <Alert type="error" message={error} />}
        {summaryBlock}
      </aside>
    </div>
  );
}
