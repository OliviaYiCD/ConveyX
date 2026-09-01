import type { FastifyInstance } from "fastify";
import type {
  GenerateInvoiceInput,
  Invoice,
  InvoiceDetail,
  Transaction,
} from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";

export async function registerBillingRoutes(app: FastifyInstance) {
  app.get("/v1/transactions", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const q = request.query as { entity_id?: string; status?: string };

    try {
      const rows = await rpc<Transaction[]>("cx_list_transactions", {
        p_entity_id: q.entity_id ?? null,
        p_status: q.status ?? null,
      });
      return reply.send(ok(rows ?? [], requestId, { total: rows?.length ?? 0 }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/invoices", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const q = request.query as { entity_id?: string };

    try {
      const rows = await rpc<Invoice[]>("cx_list_invoices", { p_entity_id: q.entity_id ?? null });
      return reply.send(ok(rows ?? [], requestId, { total: rows?.length ?? 0 }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/invoices/:invoiceId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { invoiceId } = request.params as { invoiceId: string };

    try {
      const data = await rpc<InvoiceDetail | null>("cx_get_invoice", { p_id: invoiceId });
      if (!data) {
        const err = fail("NOT_FOUND", "Invoice not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/invoices/generate", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as GenerateInvoiceInput;

    if (!body.entity_id) {
      const err = fail("VALIDATION_ERROR", "entity_id is required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const invoice = await rpc<InvoiceDetail>("cx_generate_invoice", {
        p_entity_id: body.entity_id,
        p_transaction_ids: body.transaction_ids?.length ? body.transaction_ids : null,
      });
      return reply.status(201).send(ok(invoice, requestId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invoice generation failed";
      const err = fail("INVOICE_ERROR", msg, requestId, 422);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
