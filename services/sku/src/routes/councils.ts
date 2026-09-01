import type { FastifyInstance } from "fastify";
import type { Council } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";

export async function registerCouncilRoutes(app: FastifyInstance) {
  app.get("/v1/councils", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const state = (request.query as { state?: string }).state;

    try {
      const rows = await rpc<Council[]>("cx_list_councils", { p_state: state ?? null });
      return reply.send(ok(rows ?? [], requestId, { total: rows?.length ?? 0 }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
