import type { RequiredDataField } from "@conveyx/shared-types";

export function fieldLabelMap(fields: RequiredDataField[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of fields) {
    map.set(f.field_key, f.field_name);
    map.set(String(f.field_id), f.field_name);
  }
  return map;
}

export function formatRequiredDataEntries(
  values: Record<string, unknown> | null | undefined,
  labels: Map<string, string>
): { key: string; label: string; value: string }[] {
  if (!values || typeof values !== "object") return [];
  return Object.entries(values).map(([key, raw]) => ({
    key,
    label: labels.get(key) ?? key,
    value: raw == null || raw === "" ? "—" : String(raw),
  }));
}
