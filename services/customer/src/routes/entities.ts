import type { FastifyInstance } from "fastify";
import type {
  CreateEntityInput,
  Entity,
  EntitySettings,
  UpdateEntityInput,
  UpdateEntitySettingsInput,
} from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";

export async function registerEntityRoutes(app: FastifyInstance) {
  app.get("/v1/entities", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const entityType = (request.query as { entity_type?: string }).entity_type;

    try {
      const rows = await rpc<Entity[]>("cx_list_entities", {
        p_entity_type: entityType ?? null,
      });
      return reply.send(ok(rows ?? [], requestId, { total: rows?.length ?? 0 }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/entities", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as CreateEntityInput;

    if (!body.name || !body.entity_type) {
      const err = fail("VALIDATION_ERROR", "name and entity_type are required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    if (body.entity_type === "branch" && !body.parent_entity_id) {
      const err = fail("VALIDATION_ERROR", "parent_entity_id required for branch entities", requestId, 422);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const entity = await rpc<Entity>("cx_create_entity", {
        p_name: body.name,
        p_entity_type: body.entity_type,
        p_parent_entity_id: body.parent_entity_id ?? null,
        p_abn: body.abn ?? null,
      });
      return reply.status(201).send(ok(entity, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/entities/:entityId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { entityId } = request.params as { entityId: string };

    try {
      const data = await rpc<Entity | null>("cx_get_entity", { p_id: entityId });
      if (!data) {
        const err = fail("NOT_FOUND", "Entity not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.patch("/v1/entities/:entityId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { entityId } = request.params as { entityId: string };
    const body = request.body as UpdateEntityInput;

    if (body.name === undefined && body.abn === undefined && body.status === undefined) {
      const err = fail("VALIDATION_ERROR", "No fields to update", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const data = await rpc<Entity | null>("cx_update_entity", {
        p_id: entityId,
        p_name: body.name ?? null,
        p_abn: body.abn ?? null,
        p_status: body.status ?? null,
      });
      if (!data) {
        const err = fail("NOT_FOUND", "Entity not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/entities/:entityId/settings", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { entityId } = request.params as { entityId: string };

    try {
      const data = await rpc<EntitySettings | null>("cx_get_entity_settings", { p_entity_id: entityId });
      if (!data) {
        const err = fail("NOT_FOUND", "Entity settings not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.patch("/v1/entities/:entityId/settings", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { entityId } = request.params as { entityId: string };
    const body = request.body as UpdateEntitySettingsInput;

    try {
      const data = await rpc<EntitySettings | null>("cx_update_entity_settings", {
        p_entity_id: entityId,
        p_billing_preference: body.billing_preference ?? null,
        p_billing_cycle: body.billing_cycle ?? null,
        p_payment_terms_days: body.payment_terms_days ?? null,
        p_invoice_email: body.invoice_email ?? null,
        p_stripe_customer_id: body.stripe_customer_id ?? null,
      });
      if (!data) {
        const err = fail("NOT_FOUND", "Entity settings not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/entities/:entityId/branches", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { entityId } = request.params as { entityId: string };

    try {
      const rows = await rpc<Entity[]>("cx_list_branches", { p_parent_id: entityId });
      return reply.send(ok(rows ?? [], requestId, { total: rows?.length ?? 0 }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
