import type { FastifyInstance } from "fastify";
import type { CreateRequiredDataInput, RequiredDataField } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";

export async function registerRequiredDataRoutes(app: FastifyInstance) {
  app.get("/v1/required-data", async (request, reply) => {
    const requestId = getRequestId(request.headers);

    try {
      const rows = await rpc<RequiredDataField[]>("cx_list_required_data");
      return reply.send(ok(rows ?? [], requestId, { total: rows?.length ?? 0 }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/required-data/:fieldId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { fieldId } = request.params as { fieldId: string };

    try {
      const data = await rpc<RequiredDataField | null>("cx_get_required_data", {
        p_field_id: Number(fieldId),
      });
      if (!data) {
        const err = fail("NOT_FOUND", "Required data field not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/required-data", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as CreateRequiredDataInput;

    if (!body.field_name || !body.field_type || !body.field_key) {
      const err = fail("VALIDATION_ERROR", "field_name, field_type, and field_key are required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const field = await rpc<RequiredDataField>("cx_create_required_data", {
        p_field_name: body.field_name,
        p_field_type: body.field_type,
        p_field_key: body.field_key,
        p_validation_rules: body.validation_rules ?? {},
        p_metadata: body.metadata ?? {},
      });
      return reply.status(201).send(ok(field, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.delete("/v1/required-data/:fieldId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { fieldId } = request.params as { fieldId: string };
    const id = Number(fieldId);

    if (!Number.isInteger(id) || id <= 0) {
      const err = fail("VALIDATION_ERROR", "Invalid field ID", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const data = await rpc<RequiredDataField | null>("cx_delete_required_data", {
        p_field_id: id,
      });
      if (!data) {
        const err = fail("NOT_FOUND", "Required data field not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
