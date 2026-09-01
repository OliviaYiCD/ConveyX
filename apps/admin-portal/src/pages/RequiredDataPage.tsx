import { useCallback, useEffect, useState } from "react";
import type { CreateRequiredDataInput, RequiredDataField } from "@conveyx/shared-types";
import { api } from "../api/client";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";
import { PageHeader, Alert, Loading, EmptyState } from "../components/ui";
import { FIELD_TYPES } from "../lib/constants";

const emptyField: CreateRequiredDataInput = {
  field_name: "",
  field_type: "text",
  field_key: "",
};

export function RequiredDataPage() {
  const [fields, setFields] = useState<RequiredDataField[]>([]);
  const [form, setForm] = useState<CreateRequiredDataInput>(emptyField);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldToDelete, setFieldToDelete] = useState<RequiredDataField | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<RequiredDataField[]>("/v1/required-data");
      setFields(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fields");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post<RequiredDataField>("/v1/required-data", form);
      setForm(emptyField);
      setSuccess("Field added to library.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!fieldToDelete) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.delete<RequiredDataField>(`/v1/required-data/${fieldToDelete.field_id}`);
      setSuccess(`Deleted field "${fieldToDelete.field_name}".`);
      setFieldToDelete(null);
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
        title="Required data"
        description="Field library — attach fields to products for buyer/seller capture."
      />

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <form className="card" onSubmit={(e) => void handleSubmit(e)}>
        <h3 style={{ marginTop: 0 }}>Add field</h3>
        <div className="field-row">
          <div className="field">
            <label htmlFor="field_name">Display name *</label>
            <input
              id="field_name"
              required
              value={form.field_name}
              onChange={(e) => setForm({ ...form, field_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="field_key">Key *</label>
            <input
              id="field_key"
              required
              placeholder="snake_case_key"
              value={form.field_key}
              onChange={(e) => setForm({ ...form, field_key: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="field_type">Type *</label>
            <select
              id="field_type"
              value={form.field_type}
              onChange={(e) =>
                setForm({ ...form, field_type: e.target.value as CreateRequiredDataInput["field_type"] })
              }
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Adding…" : "Add field"}
        </button>
      </form>

      <div className="card">
        {loading ? (
          <Loading />
        ) : fields.length === 0 ? (
          <EmptyState message="No fields in library." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.field_id}>
                    <td>{f.field_id}</td>
                    <td>{f.field_name}</td>
                    <td>
                      <code>{f.field_key}</code>
                    </td>
                    <td>{f.field_type}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => setFieldToDelete(f)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={fieldToDelete !== null}
        title="Delete required data field?"
        description={
          fieldToDelete ? (
            <>
              You are about to delete <strong>{fieldToDelete.field_name}</strong> (
              <code>{fieldToDelete.field_key}</code>).
            </>
          ) : null
        }
        confirmLabel="Delete field"
        confirmValue={fieldToDelete?.field_key ?? ""}
        confirmHint="Field key"
        deleting={deleting}
        onCancel={() => !deleting && setFieldToDelete(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </>
  );
}
