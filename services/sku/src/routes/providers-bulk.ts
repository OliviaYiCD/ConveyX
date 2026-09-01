import type { FastifyInstance } from "fastify";
import type { BulkImportResult, CreateProviderInput, Provider } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";

export async function registerProviderBulkRoutes(app: FastifyInstance) {
  app.post("/v1/providers/bulk", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { providers } = request.body as { providers?: CreateProviderInput[] };

    if (!providers?.length) {
      const err = fail("VALIDATION_ERROR", "providers array is required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    const result: BulkImportResult<Provider> = { created: [], errors: [], total: providers.length };

    for (let i = 0; i < providers.length; i++) {
      const body = providers[i];
      if (!body.provider_name) {
        result.errors.push({ row: i + 2, key: body.provider_name, message: "provider_name is required" });
        continue;
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
        result.created.push(provider);
      } catch (e) {
        result.errors.push({
          row: i + 2,
          key: body.provider_name,
          message: e instanceof Error ? e.message : "Database error",
        });
      }
    }

    return reply.status(result.created.length > 0 ? 201 : 422).send(ok(result, requestId));
  });
}
