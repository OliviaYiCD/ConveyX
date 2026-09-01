import type { FastifyInstance } from "fastify";
import type { AddTeamMemberInput, CreateTeamInput, Team } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";

export async function registerTeamRoutes(app: FastifyInstance) {
  app.get("/v1/teams", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const entityId = (request.query as { entity_id?: string }).entity_id;

    try {
      const rows = await rpc<Team[]>("cx_list_teams", { p_entity_id: entityId ?? null });
      return reply.send(ok(rows ?? [], requestId, { total: rows?.length ?? 0 }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/teams", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as CreateTeamInput;

    if (!body.entity_id || !body.name) {
      const err = fail("VALIDATION_ERROR", "entity_id and name are required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const data = await rpc<Team>("cx_create_team", {
        p_entity_id: body.entity_id,
        p_name: body.name,
        p_description: body.description ?? null,
      });
      return reply.status(201).send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/teams/:teamId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { teamId } = request.params as { teamId: string };

    try {
      const data = await rpc<Team | null>("cx_get_team", { p_id: teamId });
      if (!data) {
        const err = fail("NOT_FOUND", "Team not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/teams/:teamId/members", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { teamId } = request.params as { teamId: string };
    const body = request.body as AddTeamMemberInput;

    if (!body.user_id) {
      const err = fail("VALIDATION_ERROR", "user_id is required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const result = await rpc<{ team_id: string; user_id: string }>("cx_add_team_member", {
        p_team_id: teamId,
        p_user_id: body.user_id,
      });
      return reply.status(201).send(ok(result, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.delete("/v1/teams/:teamId/members/:userId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { teamId, userId } = request.params as { teamId: string; userId: string };

    try {
      await rpc("cx_remove_team_member", { p_team_id: teamId, p_user_id: userId });
      return reply.status(204).send();
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
