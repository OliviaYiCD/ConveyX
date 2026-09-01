import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  AuState,
  Council,
  CreateProductInput,
  Product,
  Provider,
  RequiredDataField,
} from "@conveyx/shared-types";
import { api } from "../api/client";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";
import { Alert, PageHeader } from "../components/ui";
import {
  AU_STATES,
  FULFILLMENT_METHODS,
  GST_OPTIONS,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
} from "../lib/constants";

const emptyForm: CreateProductInput = {
  product_name: "",
  sku: "",
  state: "NSW",
  type: "LandInfo",
  display_on_ui: true,
  description: "",
  council: "ALL",
  provider_id: "",
  required_data_buyer: [],
  required_data_seller: [],
  cost: 0,
  retail_price: 0,
  gst_option: "normal_gst_10",
  fulfillment_method: "API",
  status: "draft",
};

export function ProductFormPage() {
  const { productId } = useParams();
  const isEdit = Boolean(productId);
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateProductInput>(emptyForm);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerQuery, setProviderQuery] = useState("");
  const [councils, setCouncils] = useState<Council[]>([]);
  const [fields, setFields] = useState<RequiredDataField[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadedSku, setLoadedSku] = useState("");
  const [loadedName, setLoadedName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void Promise.all([
      api.fetchAllPages<Provider>("/v1/providers"),
      api.get<RequiredDataField[]>("/v1/required-data"),
    ]).then(([p, f]) => {
      setProviders(p);
      setFields(f);
      if (!isEdit && p.length > 0) {
        setForm((prev) => ({ ...prev, provider_id: prev.provider_id || p[0].provider_id }));
      }
    });
  }, [isEdit]);

  useEffect(() => {
    void api.get<Council[]>(`/v1/councils?state=${form.state}`).then(setCouncils);
  }, [form.state]);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    void api
      .get<Product>(`/v1/products/${productId}`)
      .then((p) => {
        setForm({
          product_name: p.product_name,
          sku: p.sku,
          state: p.state,
          type: p.type,
          display_on_ui: p.display_on_ui,
          description: p.description ?? "",
          council: p.council,
          provider_id: p.provider_id,
          required_data_buyer: p.required_data_buyer,
          required_data_seller: p.required_data_seller,
          cost: Number(p.cost),
          retail_price: Number(p.retail_price),
          gst_option: p.gst_option,
          gst_amount: p.gst_amount !== null ? Number(p.gst_amount) : null,
          fulfillment_method: p.fulfillment_method,
          status: p.status,
        });
        setLoadedSku(p.sku);
        setLoadedName(p.product_name);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load product"))
      .finally(() => setLoading(false));
  }, [productId]);

  function update<K extends keyof CreateProductInput>(key: K, value: CreateProductInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleField(list: "required_data_buyer" | "required_data_seller", id: number) {
    setForm((prev) => {
      const arr = prev[list] ?? [];
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
      return { ...prev, [list]: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (isEdit && productId) {
        await api.patch<Product>(`/v1/products/${productId}`, form);
        setSuccess("Product updated.");
      } else {
        await api.post<Product>("/v1/products", form);
        setSuccess("Product created.");
        setTimeout(() => navigate("/products"), 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!productId) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete<Product>(`/v1/products/${productId}`);
      navigate("/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="loading">Loading product…</div>;

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit product" : "Add product"}
        description="Provision a new SKU in the catalog."
        action={
          <Link to="/products" className="btn">
            ← Back
          </Link>
        }
      />

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <form className="card" onSubmit={(e) => void handleSubmit(e)}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="product_name">Product name *</label>
            <input
              id="product_name"
              required
              value={form.product_name}
              onChange={(e) => update("product_name", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="sku">SKU *</label>
            <input
              id="sku"
              required
              value={form.sku}
              onChange={(e) => update("sku", e.target.value)}
              disabled={isEdit}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="state">State *</label>
            <select
              id="state"
              value={form.state}
              onChange={(e) => update("state", e.target.value as AuState)}
            >
              {AU_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="type">Type *</label>
            <select
              id="type"
              value={form.type}
              onChange={(e) => update("type", e.target.value as CreateProductInput["type"])}
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="council">Council</label>
            <select
              id="council"
              value={form.council ?? "ALL"}
              onChange={(e) => update("council", e.target.value)}
            >
              <option value="ALL">ALL (statewide)</option>
              {councils.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="provider_id">Provider *</label>
          <input
            type="search"
            placeholder="Filter providers by name…"
            value={providerQuery}
            onChange={(e) => setProviderQuery(e.target.value)}
            style={{ marginBottom: "0.5rem" }}
          />
          <select
            id="provider_id"
            required
            value={form.provider_id}
            onChange={(e) => update("provider_id", e.target.value)}
          >
            <option value="">Select provider…</option>
            {providers
              .filter((p) => {
                const q = providerQuery.trim().toLowerCase();
                if (!q) return true;
                return (
                  p.provider_name.toLowerCase().includes(q) ||
                  p.provider_id.toLowerCase().includes(q)
                );
              })
              .map((p) => (
                <option key={p.provider_id} value={p.provider_id}>
                  {p.provider_name}
                </option>
              ))}
          </select>
          {form.provider_id && (
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
              {form.provider_id}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={form.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="cost">Cost (AUD) *</label>
            <input
              id="cost"
              type="number"
              step="0.01"
              min="0"
              required
              value={form.cost}
              onChange={(e) => update("cost", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="retail_price">Retail price (AUD) *</label>
            <input
              id="retail_price"
              type="number"
              step="0.01"
              min="0"
              required
              value={form.retail_price}
              onChange={(e) => update("retail_price", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="gst_option">GST *</label>
            <select
              id="gst_option"
              value={form.gst_option}
              onChange={(e) => update("gst_option", e.target.value as CreateProductInput["gst_option"])}
            >
              {GST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fulfillment_method">Fulfillment *</label>
            <select
              id="fulfillment_method"
              value={form.fulfillment_method}
              onChange={(e) =>
                update("fulfillment_method", e.target.value as CreateProductInput["fulfillment_method"])
              }
            >
              {FULFILLMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={form.status ?? "draft"}
              onChange={(e) => update("status", e.target.value as CreateProductInput["status"])}
            >
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field field-inline">
          <input
            id="display_on_ui"
            type="checkbox"
            checked={form.display_on_ui ?? true}
            onChange={(e) => update("display_on_ui", e.target.checked)}
          />
          <label htmlFor="display_on_ui" style={{ margin: 0 }}>
            Display on customer UI
          </label>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Required data — buyer</label>
            <div className="checkbox-grid">
              {fields.map((f) => (
                <label key={`b-${f.field_id}`} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={form.required_data_buyer?.includes(f.field_id) ?? false}
                    onChange={() => toggleField("required_data_buyer", f.field_id)}
                  />
                  {f.field_name}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Required data — seller</label>
            <div className="checkbox-grid">
              {fields.map((f) => (
                <label key={`s-${f.field_id}`} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={form.required_data_seller?.includes(f.field_id) ?? false}
                    onChange={() => toggleField("required_data_seller", f.field_id)}
                  />
                  {f.field_name}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || deleting}>
            {saving ? "Saving…" : isEdit ? "Update product" : "Create product"}
          </button>
          <Link to="/products" className="btn">
            Cancel
          </Link>
          {isEdit && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={saving || deleting}
              onClick={() => setDeleteOpen(true)}
              style={{ marginLeft: "auto" }}
            >
              Delete product
            </button>
          )}
        </div>
      </form>

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Delete product"
        description={
          <>
            Delete <strong>{loadedName || form.product_name}</strong> (
            <code>{loadedSku || form.sku}</code>)? This removes the SKU from the catalog.
          </>
        }
        confirmLabel="Delete product"
        confirmValue={loadedSku || form.sku}
        confirmHint="Type the SKU to confirm"
        warning="This cannot be undone. Products used on existing orders cannot be deleted."
        deleting={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
