import { useCallback, useEffect, useState } from "react";
import type {
  BulkImportResult,
  CreatePackageInput,
  CreateProductInput,
  CreateProviderInput,
  CreateRequiredDataInput,
  PackageDetail,
  Product,
  Provider,
  RequiredDataField,
} from "@conveyx/shared-types";
import { api } from "../api/client";
import { csvRowsToObjects, downloadCsv, parseCsv } from "../lib/csv";
import {
  parsePackageRows,
  parseProductRows,
  parseProviderRows,
  parseRequiredDataRows,
  type ParsedRow,
} from "../lib/import/parsers";
import {
  CSV_TEMPLATES,
  IMPORT_HINTS,
  IMPORT_KIND_LABELS,
  IMPORT_ORDER,
  type ImportKind,
} from "../lib/import/templates";
import { Alert, PageHeader } from "../components/ui";

type ImportResult =
  | BulkImportResult<Product>
  | BulkImportResult<Provider>
  | BulkImportResult<RequiredDataField>
  | BulkImportResult<PackageDetail>;

type ImportEntityMap = {
  products: Product;
  providers: Provider;
  requiredData: RequiredDataField;
  packages: PackageDetail;
};

const BULK_PATH: Record<ImportKind, string> = {
  products: "/v1/products/bulk",
  providers: "/v1/providers/bulk",
  requiredData: "/v1/required-data/bulk",
  packages: "/v1/packages/bulk",
};

const BULK_BODY_KEY: Record<ImportKind, string> = {
  products: "products",
  providers: "providers",
  requiredData: "fields",
  packages: "packages",
};

export function ImportPage() {
  const [kind, setKind] = useState<ImportKind>("products");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRow<unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [fields, setFields] = useState<RequiredDataField[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    void Promise.all([
      api.fetchAllPages<Provider>("/v1/providers"),
      api.get<RequiredDataField[]>("/v1/required-data"),
      api.fetchAllPages<Product>("/v1/products"),
    ]).then(([p, f, pr]) => {
      setProviders(p);
      setFields(f);
      setProducts(pr);
    });
  }, []);

  const validCount = parsed.filter((r) => r.data && r.errors.length === 0).length;
  const invalidCount = parsed.length - validCount;

  const parseFile = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);
      setFileName(file.name);
      const text = await file.text();
      const rows = parseCsv(text);
      const objects = csvRowsToObjects(rows);

      if (objects.length === 0) {
        setError("CSV is empty or missing data rows.");
        setParsed([]);
        return;
      }

      let next: ParsedRow<unknown>[];
      switch (kind) {
        case "products":
          next = parseProductRows(objects, providers, fields);
          break;
        case "providers":
          next = parseProviderRows(objects);
          break;
        case "requiredData":
          next = parseRequiredDataRows(objects);
          break;
        case "packages":
          next = parsePackageRows(objects, products);
          break;
      }
      setParsed(next);
    },
    [kind, providers, fields, products]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void parseFile(file);
    e.target.value = "";
  }

  function handleKindChange(next: ImportKind) {
    setKind(next);
    setParsed([]);
    setFileName(null);
    setResult(null);
    setError(null);
  }

  async function handleImport() {
    const valid = parsed.filter((r) => r.data && r.errors.length === 0);
    if (valid.length === 0) {
      setError("No valid rows to import.");
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    const items = valid.map((r) => r.data!);
    const path = BULK_PATH[kind];
    const bodyKey = BULK_BODY_KEY[kind];
    const BATCH_SIZE = 250;

    try {
      const merged: BulkImportResult<ImportEntityMap[typeof kind]> = {
        created: [],
        errors: [],
        total: items.length,
      };

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const chunk = items.slice(i, i + BATCH_SIZE);
        const data = await api.post<BulkImportResult<ImportEntityMap[typeof kind]>>(path, {
          [bodyKey]: chunk,
        });
        merged.created.push(...data.created);
        merged.errors.push(
          ...data.errors.map((e) => ({
            ...e,
            row: e.row + i,
          }))
        );
      }

      setResult(merged as ImportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const previewHeaders =
    kind === "products"
      ? [
          "row",
          "sku",
          "product_name",
          "state",
          "provider_id",
          "cost",
          "retail",
          "status",
          "errors",
        ]
      : kind === "providers"
        ? ["row", "provider_name", "email", "errors"]
        : kind === "requiredData"
          ? ["row", "field_key", "field_name", "type", "errors"]
          : ["row", "package_name", "scope", "products", "errors"];

  return (
    <>
      <PageHeader
        title="Bulk CSV import"
        description="Upload catalog data in bulk. Download a template, fill it in Excel or Google Sheets, then import."
      />

      {error && <Alert type="error" message={error} />}
      {result && (
        <Alert
          type={result.errors.length === 0 ? "success" : "error"}
          message={`Imported ${result.created.length} of ${result.total} rows.${
            result.errors.length ? ` ${result.errors.length} failed.` : ""
          }`}
        />
      )}

      <div className="tabs">
        {IMPORT_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            className={kind === k ? "tab active" : "tab"}
            onClick={() => handleKindChange(k)}
          >
            {IMPORT_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <p className="muted import-hint">{IMPORT_HINTS[kind]}</p>

      <div className="card">
        <div className="toolbar">
          <button
            type="button"
            className="btn"
            onClick={() => downloadCsv(`${kind}-template.csv`, CSV_TEMPLATES[kind])}
          >
            Download template
          </button>
          <label className="btn btn-primary file-label">
            Choose CSV
            <input type="file" accept=".csv,text/csv" onChange={handleFileChange} hidden />
          </label>
          {fileName && <span className="muted">File: {fileName}</span>}
        </div>

        {parsed.length > 0 && (
          <>
            <p className="muted">
              {validCount} valid · {invalidCount} with errors · {parsed.length} total rows
            </p>

            <div className="table-wrap preview-table">
              <table>
                <thead>
                  <tr>
                    {previewHeaders.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row) => {
                    const errText = row.errors.join("; ");
                    if (kind === "products") {
                      const d = row.data as CreateProductInput | undefined;
                      return (
                        <tr key={row.row} className={errText ? "row-error" : ""}>
                          <td>{row.row}</td>
                          <td>{d?.sku ?? "—"}</td>
                          <td>{d?.product_name ?? "—"}</td>
                          <td>{d?.state ?? "—"}</td>
                          <td>{d?.provider_id ?? "—"}</td>
                          <td>{d?.cost ?? "—"}</td>
                          <td>{d?.retail_price ?? "—"}</td>
                          <td>{d?.status ?? "—"}</td>
                          <td className="error-cell">{errText || "—"}</td>
                        </tr>
                      );
                    }
                    if (kind === "providers") {
                      const d = row.data as CreateProviderInput | undefined;
                      return (
                        <tr key={row.row} className={errText ? "row-error" : ""}>
                          <td>{row.row}</td>
                          <td>{d?.provider_name ?? "—"}</td>
                          <td>{d?.email ?? "—"}</td>
                          <td className="error-cell">{errText || "—"}</td>
                        </tr>
                      );
                    }
                    if (kind === "requiredData") {
                      const d = row.data as CreateRequiredDataInput | undefined;
                      return (
                        <tr key={row.row} className={errText ? "row-error" : ""}>
                          <td>{row.row}</td>
                          <td>{d?.field_key ?? "—"}</td>
                          <td>{d?.field_name ?? "—"}</td>
                          <td>{d?.field_type ?? "—"}</td>
                          <td className="error-cell">{errText || "—"}</td>
                        </tr>
                      );
                    }
                    const d = row.data as CreatePackageInput | undefined;
                    return (
                      <tr key={row.row} className={errText ? "row-error" : ""}>
                        <td>{row.row}</td>
                        <td>{d?.package_name ?? "—"}</td>
                        <td>{d?.scope_type ?? "—"}</td>
                        <td>{d?.items?.length ?? 0} products</td>
                        <td className="error-cell">{errText || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={importing || validCount === 0}
                onClick={() => void handleImport()}
              >
                {importing ? "Importing…" : `Import ${validCount} row${validCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
      </div>

      {result && result.errors.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Import errors</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Key</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((e, i) => (
                  <tr key={i}>
                    <td>{e.row}</td>
                    <td>{e.key ?? "—"}</td>
                    <td className="error-cell">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Product CSV columns</h3>
        <p className="muted" style={{ marginBottom: 0.5 }}>
          <code>
            product_name, sku, state, type, display_on_ui, description, council, provider_name, cost,
            retail_price, gst_option, gst_amount, fulfillment_method, status, required_data_buyer,
            required_data_seller
          </code>
        </p>
        <ul className="column-help">
          <li>
            <strong>state</strong> — NSW, VIC, QLD, SA, WA, TAS, NT, ACT
          </li>
          <li>
            <strong>type</strong> — LGA, BodyCorp, LandInfo, State_government, Utility, Other
          </li>
          <li>
            <strong>council</strong> — ALL or council code (e.g. SYDNEY)
          </li>
          <li>
            <strong>provider_name</strong> — must match an existing provider (import providers first)
          </li>
          <li>
            <strong>required_data_*</strong> — pipe-separated field keys (e.g.{" "}
            <code>buyer_full_name|company_abn</code>)
          </li>
          <li>
            <strong>gst_option</strong> — no_gst, normal_gst_10, fixed_gst_percent, fixed_gst_amount
          </li>
          <li>
            <strong>fulfillment_method</strong> — API, Automation, Manual
          </li>
        </ul>
      </div>
    </>
  );
}
