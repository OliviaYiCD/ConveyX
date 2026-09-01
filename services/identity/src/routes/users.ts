import type { FastifyInstance } from "fastify";
import type { CreateUserProfileInput, RoleAssignment, UserProfile } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getDemoUserId, getRequestId, ok } from "../lib/response.js";

interface UserMeResponse {
  profile: UserProfile;
  roles: RoleAssignment[];
  team_ids: string[];
}

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/v1/users/me", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const userId = getDemoUserId();

    try {
      const data = await rpc<UserMeResponse | null>("cx_get_user_me", { p_user_id: userId });
      if (!data) {
        const err = fail("NOT_FOUND", "User profile not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/users", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const entityId = (request.query as { entity_id?: string }).entity_id;

    try {
      const rows = await rpc<UserProfile[]>("cx_list_users", { p_entity_id: entityId ?? null });
      return reply.send(ok(rows ?? [], requestId, { total: rows?.length ?? 0 }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/users", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as CreateUserProfileInput;

    if (!body.id || !body.entity_id || !body.email) {
      const err = fail("VALIDATION_ERROR", "id, entity_id, and email are required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const profile = await rpc<UserProfile>("cx_create_user", {
        p_id: body.id,
        p_entity_id: body.entity_id,
        p_email: body.email,
        p_first_name: body.first_name ?? null,
        p_last_name: body.last_name ?? null,
        p_roles: body.roles ?? ["entity_user"],
      });
      return reply.status(201).send(ok(profile, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/users/:userId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { userId } = request.params as { userId: string };

    try {
      const data = await rpc<UserProfile | null>("cx_get_user", { p_id: userId });
      if (!data) {
        const err = fail("NOT_FOUND", "User not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
