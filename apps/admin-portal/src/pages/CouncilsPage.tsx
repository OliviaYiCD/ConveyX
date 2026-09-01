import { useCallback, useEffect, useState } from "react";
import type { AuState, Council } from "@conveyx/shared-types";
import { api } from "../api/client";
import { PageHeader, Alert, Loading, EmptyState } from "../components/ui";
import { AU_STATES } from "../lib/constants";

export function CouncilsPage() {
  const [councils, setCouncils] = useState<Council[]>([]);
  const [stateFilter, setStateFilter] = useState<AuState | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = stateFilter ? `?state=${stateFilter}` : "";
      const data = await api.get<Council[]>(`/v1/councils${qs}`);
      setCouncils(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load councils");
    } finally {
      setLoading(false);
    }
  }, [stateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Councils"
        description="Reference data for LGA-scoped products. Read-only — seeded from Supabase."
      />

      {error && <Alert type="error" message={error} />}

      <div className="card">
        <div className="toolbar">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as AuState | "")}
            style={{ width: "140px" }}
          >
            <option value="">All states</option>
            {AU_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <Loading />
        ) : councils.length === 0 ? (
          <EmptyState message="No councils found." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {councils.map((c) => (
                  <tr key={`${c.state}-${c.code}`}>
                    <td>
                      <code>{c.code}</code>
                    </td>
                    <td>{c.name}</td>
                    <td>{c.state}</td>
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
