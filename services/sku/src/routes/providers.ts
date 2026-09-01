import type { FastifyInstance } from "fastify";
import type { CreateProviderInput, Provider, ProviderListResult } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";

export async function registerProviderRoutes(app: FastifyInstance) {
  app.get("/v1/providers", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const q = request.query as {
      search?: string;
      state?: string;
      provider_type?: string;
      page?: string;
      page_size?: string;
    };

    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(q.page_size) || 50));
    const offset = (page - 1) * pageSize;

    try {
      const result = await rpc<ProviderListResult>("cx_list_providers", {
        p_search: q.search?.trim() || null,
        p_state: q.state?.trim() || null,
        p_provider_type: q.provider_type?.trim() || null,
        p_limit: pageSize,
        p_offset: offset,
      });
      const items = result?.items ?? [];
      const total = result?.total ?? items.length;
      return reply.send(ok(items, requestId, { total, page, page_size: pageSize }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/providers/:providerId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { providerId } = request.params as { providerId: string };

    try {
      const data = await rpc<Provider | null>("cx_get_provider", { p_id: providerId });
      if (!data) {
        const err = fail("NOT_FOUND", "Provider not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/providers", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as CreateProviderInput;

    if (!body.provider_name) {
      const err = fail("VALIDATION_ERROR", "provider_name is required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const provider = await rpc<Provider>("cx_create_provider", {
        p_provider_name: body.provider_name,
        p_provider_type: body.provider_type ?? null,
        p_state: body.state ?? null,
        p_payment_method: body.payment_method ?? null,
        p_payment_details: body.payment_details ?? {},
        p_description: body.description ?? null,
        p_address: body.address ?? null,
        p_email: body.email ?? null,
        p_contact_number: body.contact_number ?? null,
        p_website: body.website ?? null,
      });
      return reply.status(201).send(ok(provider, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.patch("/v1/providers/:providerId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { providerId } = request.params as { providerId: string };
    const body = request.body as Partial<CreateProviderInput>;

    try {
      const data = await rpc<Provider | null>("cx_update_provider", {
        p_id: providerId,
        p_provider_name: body.provider_name ?? null,
        p_provider_type: body.provider_type ?? null,
        p_state: body.state ?? null,
        p_payment_method: body.payment_method ?? null,
        p_payment_details: body.payment_details ?? null,
        p_description: body.description ?? null,
        p_address: body.address ?? null,
        p_email: body.email ?? null,
        p_contact_number: body.contact_number ?? null,
        p_website: body.website ?? null,
      });
      if (!data) {
        const err = fail("NOT_FOUND", "Provider not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.delete("/v1/providers/:providerId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { providerId } = request.params as { providerId: string };

    try {
      const data = await rpc<Provider | null>("cx_delete_provider", { p_id: providerId });
      if (!data) {
        const err = fail("NOT_FOUND", "Provider not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      const status = msg.includes("Cannot delete") ? 409 : 500;
      const err = fail(status === 409 ? "IN_USE" : "DB_ERROR", msg, requestId, status);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/providers/purge-unused", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    try {
      const data = await rpc<{ deleted: number }>("cx_delete_unused_providers");
      return reply.send(ok(data ?? { deleted: 0 }, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Delete failed", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
