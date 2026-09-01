import type { FastifyInstance } from "fastify";
import type { PropertyIdentifierRequest } from "@conveyx/shared-types";
import { buildRecommendations } from "../lib/recommend.js";
import { resolvePropertyIdentifier, validateIdentifierRequest } from "../lib/resolve.js";
import type { SkuClient } from "../lib/sku-client.js";
import { fail, getRequestId, ok } from "../lib/response.js";

export function registerIntelligenceRoutes(app: FastifyInstance, skuClient: SkuClient) {
  app.post("/v1/intelligence/resolve", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as PropertyIdentifierRequest;

    const validationError = validateIdentifierRequest(body);
    if (validationError) {
      const err = fail("VALIDATION_ERROR", validationError, requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const context = resolvePropertyIdentifier(body);
      return reply.send(ok(context, requestId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Resolution failed";
      const err = fail("RESOLUTION_ERROR", msg, requestId, 422);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/intelligence/recommend", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as PropertyIdentifierRequest;

    const validationError = validateIdentifierRequest(body);
    if (validationError) {
      const err = fail("VALIDATION_ERROR", validationError, requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const context = resolvePropertyIdentifier(body);
      const recommendations = await buildRecommendations(skuClient, context, requestId, {
        includeBodyCorp: body.include_body_corp,
      });
      return reply.send(ok(recommendations, requestId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Recommendation failed";
      const code = msg.includes("SKU service") ? "UPSTREAM_ERROR" : "RESOLUTION_ERROR";
      const status = code === "UPSTREAM_ERROR" ? 502 : 422;
      const err = fail(code, msg, requestId, status);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
