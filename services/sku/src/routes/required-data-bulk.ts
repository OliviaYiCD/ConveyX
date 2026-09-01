import type { FastifyInstance } from "fastify";
import type {
  BulkImportResult,
  CreateRequiredDataInput,
  RequiredDataField,
} from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";

export async function registerRequiredDataBulkRoutes(app: FastifyInstance) {
  app.post("/v1/required-data/bulk", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { fields } = request.body as { fields?: CreateRequiredDataInput[] };

    if (!fields?.length) {
      const err = fail("VALIDATION_ERROR", "fields array is required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    const result: BulkImportResult<RequiredDataField> = { created: [], errors: [], total: fields.length };

    for (let i = 0; i < fields.length; i++) {
      const body = fields[i];
      if (!body.field_name || !body.field_type || !body.field_key) {
        result.errors.push({
          row: i + 2,
          key: body.field_key,
          message: "field_name, field_type, and field_key are required",
        });
        continue;
      }
      try {
        const field = await rpc<RequiredDataField>("cx_create_required_data", {
          p_field_name: body.field_name,
          p_field_type: body.field_type,
          p_field_key: body.field_key,
          p_validation_rules: body.validation_rules ?? {},
          p_metadata: body.metadata ?? {},
        });
        result.created.push(field);
      } catch (e) {
        result.errors.push({
          row: i + 2,
          key: body.field_key,
          message: e instanceof Error ? e.message : "Database error",
        });
      }
    }

    return reply.status(result.created.length > 0 ? 201 : 422).send(ok(result, requestId));
  });
}
