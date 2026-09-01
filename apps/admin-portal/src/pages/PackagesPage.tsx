import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Package, ProductStatus } from "@conveyx/shared-types";
import { api } from "../api/client";
import { PageHeader, Alert, Loading, EmptyState } from "../components/ui";
import { statusClass } from "../lib/constants";

export function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Package[]>("/v1/packages");
      setPackages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load packages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: ProductStatus) {
    try {
      await api.post<Package>(`/v1/packages/${id}/status`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  return (
    <>
      <PageHeader
        title="Packages"
        description="Bundle products into scoped packages for customers."
        action={
          <Link to="/packages/new" className="btn btn-primary">
            + Add package
          </Link>
        }
      />

      {error && <Alert type="error" message={error} />}

      <div className="card">
        {loading ? (
          <Loading />
        ) : packages.length === 0 ? (
          <EmptyState message="No packages yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Scope</th>
                  <th>State / Council</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>{pkg.package_name}</td>
                    <td>{pkg.scope_type}</td>
                    <td>
                      {pkg.scope_state ?? "—"}
                      {pkg.scope_council ? ` / ${pkg.scope_council}` : ""}
                    </td>
                    <td>
                      <span className={statusClass(pkg.status)}>{pkg.status}</span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <Link to={`/packages/${pkg.id}`} className="btn btn-sm">
                          View
                        </Link>
                        {pkg.status !== "active" && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => void setStatus(pkg.id, "active")}
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
