import Fastify from "fastify";
import cors from "@fastify/cors";
import { fail, getEnv, getRequestId, ok } from "./lib/response.js";
import { SkuClient } from "./lib/sku-client.js";
import { registerIntelligenceRoutes } from "./routes/intelligence.js";

const port = Number(process.env.CATALOG_INTELLIGENCE_PORT ?? process.env.PORT ?? 3004);
const skuUrl = process.env.SKU_SERVICE_URL ?? "http://localhost:3003";

const app = Fastify({ logger: true });
const skuClient = new SkuClient(skuUrl);

await app.register(cors, { origin: true });

app.get("/health", async (request, reply) => {
  const requestId = getRequestId(request.headers);
  return reply.send(ok({ status: "ok", service: "catalog-intelligence-service" }, requestId));
});

app.get("/health/ready", async (request, reply) => {
  const requestId = getRequestId(request.headers);
  const skuOk = await skuClient.healthCheck();
  if (!skuOk) {
    const err = fail("NOT_READY", "SKU service unavailable", requestId, 503);
    return reply.status(err.statusCode).send(err.body);
  }
  return reply.send(ok({ status: "ready", service: "catalog-intelligence-service" }, requestId));
});

await registerIntelligenceRoutes(app, skuClient);

try {
  getEnv("SKU_SERVICE_URL", skuUrl);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`catalog-intelligence-service listening on :${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
