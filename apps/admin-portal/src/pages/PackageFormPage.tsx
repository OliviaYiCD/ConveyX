import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  AuState,
  Council,
  CreatePackageInput,
  PackageDetail,
  Product,
} from "@conveyx/shared-types";
import { api } from "../api/client";
import { Alert, PageHeader, Loading } from "../components/ui";
import { AU_STATES, PACKAGE_SCOPES, PRODUCT_STATUSES } from "../lib/constants";

export function PackageFormPage() {
  const { packageId } = useParams();
  const isView = Boolean(packageId);
  const navigate = useNavigate();

  const [detail, setDetail] = useState<PackageDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [councils, setCouncils] = useState<Council[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [form, setForm] = useState<CreatePackageInput>({
    package_name: "",
    description: "",
    scope_type: "state",
    scope_state: "NSW",
    scope_council: null,
    display_on_ui: true,
    status: "draft",
  });
  const [loading, setLoading] = useState(isView);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void api.fetchAllPages<Product>("/v1/products?status=active").then(setProducts);
  }, []);

  useEffect(() => {
    if (form.scope_state) {
      void api.get<Council[]>(`/v1/councils?state=${form.scope_state}`).then(setCouncils);
    }
  }, [form.scope_state]);

  useEffect(() => {
    if (!packageId) return;
    setLoading(true);
    void api
      .get<PackageDetail>(`/v1/packages/${packageId}`)
      .then((d) => {
        setDetail(d);
        setSelectedProducts(d.items.map((i) => i.product_id));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load package"))
      .finally(() => setLoading(false));
  }, [packageId]);

  function toggleProduct(id: string) {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const items = selectedProducts.map((product_id, i) => ({
        product_id,
        sort_order: i,
        is_optional: false,
      }));
      await api.post("/v1/packages", { ...form, items });
      setSuccess("Package created.");
      setTimeout(() => navigate("/packages"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateItems() {
    if (!packageId) return;
    setSaving(true);
    setError(null);
    try {
      const items = selectedProducts.map((product_id, i) => ({
        product_id,
        sort_order: i,
        is_optional: false,
      }));
      const updated = await api.put<PackageDetail>(`/v1/packages/${packageId}/items`, { items });
      setDetail(updated);
      setSuccess("Package items updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (isView && loading) return <Loading label="Loading package…" />;

  if (isView && detail) {
    return (
      <>
        <PageHeader
          title={detail.package.package_name}
          description={detail.package.description ?? undefined}
          action={
            <Link to="/packages" className="btn">
              ← Back
            </Link>
          }
        />
        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}

        <div className="card">
          <p className="muted">
            Scope: {detail.package.scope_type}
            {detail.package.scope_state ? ` · ${detail.package.scope_state}` : ""}
            {detail.package.scope_council ? ` · ${detail.package.scope_council}` : ""}
          </p>
          <h3>Products in package</h3>
          <div className="checkbox-grid">
            {products.map((p) => (
              <label key={p.id} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedProducts.includes(p.id)}
                  onChange={() => toggleProduct(p.id)}
                />
                {p.sku} — {p.product_name}
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={() => void handleUpdateItems()}
            >
              {saving ? "Saving…" : "Update items"}
            </button>
          </div>
        </div>

        {detail.items.length > 0 && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Current items</h3>
            <ul>
              {detail.items.map((item) => (
                <li key={item.product_id}>
                  {item.product?.sku ?? item.product_id} — {item.product?.product_name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Add package"
        description="Create a product bundle with global, state, or council scope."
        action={
          <Link to="/packages" className="btn">
            ← Back
          </Link>
        }
      />

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <form className="card" onSubmit={(e) => void handleCreate(e)}>
        <div className="field">
          <label htmlFor="package_name">Package name *</label>
          <input
            id="package_name"
            required
            value={form.package_name}
            onChange={(e) => setForm({ ...form, package_name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="scope_type">Scope *</label>
            <select
              id="scope_type"
              value={form.scope_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  scope_type: e.target.value as CreatePackageInput["scope_type"],
                })
              }
            >
              {PACKAGE_SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {form.scope_type !== "global" && (
            <div className="field">
              <label htmlFor="scope_state">State</label>
              <select
                id="scope_state"
                value={form.scope_state ?? ""}
                onChange={(e) =>
                  setForm({ ...form, scope_state: e.target.value as AuState })
                }
              >
                {AU_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.scope_type === "council" && (
            <div className="field">
              <label htmlFor="scope_council">Council</label>
              <select
                id="scope_council"
                value={form.scope_council ?? ""}
                onChange={(e) => setForm({ ...form, scope_council: e.target.value })}
              >
                <option value="">Select council…</option>
                {councils.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={form.status ?? "draft"}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as CreatePackageInput["status"] })
              }
            >
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Products to include</label>
          <div className="checkbox-grid">
            {products.map((p) => (
              <label key={p.id} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedProducts.includes(p.id)}
                  onChange={() => toggleProduct(p.id)}
                />
                {p.sku} — {p.product_name} ({p.state})
              </label>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Creating…" : "Create package"}
          </button>
        </div>
      </form>
    </>
  );
}
