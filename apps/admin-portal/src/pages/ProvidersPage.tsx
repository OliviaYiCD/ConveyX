import { useCallback, useEffect, useState } from "react";
import type { AuState, CreateProviderInput, ProductType, Provider } from "@conveyx/shared-types";
import { api } from "../api/client";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";
import { PageHeader, Alert, Loading, EmptyState } from "../components/ui";
import {
  AU_STATES,
  PRODUCT_TYPES,
  PROVIDER_TYPE_LABELS,
} from "../lib/constants";

const PAGE_SIZE = 50;

const emptyProvider: CreateProviderInput = {
  provider_name: "",
  provider_type: "LGA",
  state: "NSW",
  email: "",
  contact_number: "",
  website: "",
  description: "",
};

function providerTypeLabel(type: ProductType | null | undefined): string {
  if (!type) return "—";
  return PROVIDER_TYPE_LABELS[type] ?? type;
}

export function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<CreateProviderInput>(emptyProvider);
  const [searchInput, setSearchInput] = useState("");
  const [stateFilter, setStateFilter] = useState<AuState | "">("");
  const [typeFilter, setTypeFilter] = useState<ProductType | "">("");
  const [applied, setApplied] = useState({
    search: "",
    state: "" as AuState | "",
    type: "" as ProductType | "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (applied.search) params.set("search", applied.search);
      if (applied.state) params.set("state", applied.state);
      if (applied.type) params.set("provider_type", applied.type);
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      const { items, meta } = await api.getList<Provider>(`/v1/providers?${params.toString()}`);
      setProviders(items);
      setTotal(meta.total ?? items.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load providers");
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
    });
  }

  function clearFilters() {
    setSearchInput("");
    setStateFilter("");
    setTypeFilter("");
    setPage(1);
    setApplied({ search: "", state: "", type: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post<Provider>("/v1/providers", form);
      setForm(emptyProvider);
      setSuccess("Provider created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOne() {
    if (!providerToDelete) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.delete<Provider>(`/v1/providers/${providerToDelete.provider_id}`);
      setSuccess(`Deleted "${providerToDelete.provider_name}".`);
      setProviderToDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function handlePurgeUnused() {
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.post<{ deleted: number }>("/v1/providers/purge-unused", {});
      setSuccess(`Deleted ${result.deleted} unused provider${result.deleted === 1 ? "" : "s"}.`);
      setPurgeOpen(false);
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Providers"
        description="Search and filter certificate providers by state, type, name, or contact details."
      />

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

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
              <label htmlFor="provider-search">Search</label>
              <input
                id="provider-search"
                type="search"
                placeholder="Name, ID, email, website, description…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="provider-state">State</label>
              <select
                id="provider-state"
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
              <label htmlFor="provider-type">Type</label>
              <select
                id="provider-type"
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
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setPurgeOpen(true)}>
              Delete unused
            </button>
            {!loading && (
              <span className="muted orders-search-count">
                {total} provider{total === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </form>

        {loading ? (
          <Loading />
        ) : providers.length === 0 ? (
          <EmptyState message="No providers match your filters." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>State</th>
                    <th>Contact</th>
                    <th>Description</th>
                    <th>ID</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.provider_id}>
                      <td>
                        <strong>{p.provider_name}</strong>
                        {p.website && (
                          <div className="muted" style={{ fontSize: "0.8rem" }}>
                            <a href={p.website} target="_blank" rel="noreferrer">
                              {p.website.replace(/^https?:\/\//, "")}
                            </a>
                          </div>
                        )}
                      </td>
                      <td>{providerTypeLabel(p.provider_type)}</td>
                      <td>{p.state ?? "—"}</td>
                      <td className="muted" style={{ fontSize: "0.85rem" }}>
                        {p.email && <div>{p.email}</div>}
                        {p.contact_number && <div>{p.contact_number}</div>}
                        {p.address && <div>{p.address}</div>}
                        {!p.email && !p.contact_number && !p.address && "—"}
                      </td>
                      <td className="muted products-cell">{p.description ?? "—"}</td>
                      <td>
                        <code style={{ fontSize: "0.72rem" }}>{p.provider_id.slice(0, 8)}…</code>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => setProviderToDelete(p)}
                        >
                          Delete
                        </button>
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

      <form className="card" onSubmit={(e) => void handleSubmit(e)}>
        <h3 style={{ marginTop: 0 }}>Add provider</h3>
        <div className="field-row">
          <div className="field">
            <label htmlFor="provider_name">Name *</label>
            <input
              id="provider_name"
              required
              value={form.provider_name}
              onChange={(e) => setForm({ ...form, provider_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="new_provider_type">Type</label>
            <select
              id="new_provider_type"
              value={form.provider_type ?? ""}
              onChange={(e) =>
                setForm({ ...form, provider_type: e.target.value as ProductType })
              }
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROVIDER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="new_state">State</label>
            <select
              id="new_state"
              value={form.state ?? ""}
              onChange={(e) => setForm({ ...form, state: e.target.value as AuState })}
            >
              {AU_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="contact_number">Phone</label>
            <input
              id="contact_number"
              value={form.contact_number ?? ""}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              placeholder="https://…"
              value={form.website ?? ""}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="description">Description</label>
          <input
            id="description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Creating…" : "Create provider"}
        </button>
      </form>

      <ConfirmDeleteModal
        open={providerToDelete != null}
        title="Delete provider"
        description={
          providerToDelete ? (
            <p>
              Delete <strong>{providerToDelete.provider_name}</strong>? This only works if no products
              use this provider.
            </p>
          ) : null
        }
        warning="This cannot be undone. Providers linked to products cannot be deleted."
        confirmLabel="Delete provider"
        confirmValue={providerToDelete?.provider_name ?? ""}
        confirmHint="Type the provider name to confirm"
        deleting={deleting}
        onCancel={() => setProviderToDelete(null)}
        onConfirm={() => void handleDeleteOne()}
      />

      <ConfirmDeleteModal
        open={purgeOpen}
        title="Delete unused providers"
        description={
          <p>
            Removes every provider that is <strong>not</strong> linked to a product. Use this before
            re-importing <code>providers-all.csv</code>.
          </p>
        }
        warning="This cannot be undone. Providers used by products are kept."
        confirmLabel="Delete unused providers"
        confirmValue="DELETE UNUSED"
        confirmHint='Type DELETE UNUSED to confirm'
        deleting={deleting}
        onCancel={() => setPurgeOpen(false)}
        onConfirm={() => void handlePurgeUnused()}
      />
    </>
  );
}
