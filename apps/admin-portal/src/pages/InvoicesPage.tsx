import { useCallback, useEffect, useState } from "react";
import type { Invoice, InvoiceDetail, Transaction } from "@conveyx/shared-types";
import { api } from "../api/client";
import { PageHeader, Alert, Loading } from "../components/ui";
import { formatCurrency } from "../lib/constants";

const DEMO_ENTITY_ID = "11111111-1111-1111-1111-111111111111";

export function InvoicesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tx, inv] = await Promise.all([
        api.get<Transaction[]>(`/v1/transactions?entity_id=${DEMO_ENTITY_ID}&status=pending`),
        api.get<Invoice[]>(`/v1/invoices?entity_id=${DEMO_ENTITY_ID}`),
      ]);
      setTransactions(tx);
      setInvoices(inv);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateInvoice() {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const invoice = await api.post<InvoiceDetail>("/v1/invoices/generate", {
        entity_id: DEMO_ENTITY_ID,
      });
      setSuccess(`Invoice ${invoice.invoice.invoice_number} generated.`);
      setSelectedInvoice(invoice);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invoice generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function viewInvoice(id: string) {
    try {
      const detail = await api.get<InvoiceDetail>(`/v1/invoices/${id}`);
      setSelectedInvoice(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoice");
    }
  }

  return (
    <>
      <PageHeader
        title="Billing & invoices"
        description="Generate invoices from submitted customer orders (POC — no payment gateway)."
      />

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Pending transactions</h3>
        {loading ? (
          <Loading />
        ) : transactions.length === 0 ? (
          <p className="muted">No pending transactions.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Description</th>
                    <th>Total</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <code>{t.reference}</code>
                      </td>
                      <td className="muted">{t.description}</td>
                      <td>{formatCurrency(Number(t.total))}</td>
                      <td>{new Date(t.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={generating}
                onClick={() => void generateInvoice()}
              >
                {generating ? "Generating…" : `Generate invoice (${transactions.length} transactions)`}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Invoices</h3>
        {invoices.length === 0 ? (
          <p className="muted">No invoices yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Issued</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <code>{inv.invoice_number}</code>
                    </td>
                    <td>{inv.status}</td>
                    <td>{formatCurrency(Number(inv.total))}</td>
                    <td>{inv.issued_at ? new Date(inv.issued_at).toLocaleString() : "—"}</td>
                    <td>
                      <button type="button" className="btn btn-sm" onClick={() => void viewInvoice(inv.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedInvoice && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Invoice {selectedInvoice.invoice.invoice_number}</h3>
          <p className="muted">
            Total: {formatCurrency(Number(selectedInvoice.invoice.total))} · Status:{" "}
            {selectedInvoice.invoice.status}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>GST</th>
                  <th>Line total</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.description}</td>
                    <td>{formatCurrency(Number(line.amount))}</td>
                    <td>{formatCurrency(Number(line.gst_amount))}</td>
                    <td>{formatCurrency(Number(line.line_total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
