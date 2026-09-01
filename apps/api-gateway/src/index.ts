import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import proxy from "@fastify/http-proxy";

const port = Number(process.env.GATEWAY_PORT ?? process.env.PORT ?? 3000);
const identityUrl = process.env.IDENTITY_SERVICE_URL ?? "http://localhost:3001";
const customerUrl = process.env.CUSTOMER_SERVICE_URL ?? "http://localhost:3002";
const skuUrl = process.env.SKU_SERVICE_URL ?? "http://localhost:3003";
const catalogIntelligenceUrl =
  process.env.CATALOG_INTELLIGENCE_SERVICE_URL ?? "http://localhost:3004";
const orderUrl = process.env.ORDER_SERVICE_URL ?? "http://localhost:3007";
const billingUrl = process.env.BILLING_SERVICE_URL ?? "http://localhost:3009";

function getRequestId(headers: Record<string, string | string[] | undefined>): string {
  const raw = headers["x-request-id"];
  if (typeof raw === "string" && raw.length > 0) return raw;
  return randomUUID();
}

const app = Fastify({
  logger: true,
  // Bulk CSV imports (thousands of products) exceed Fastify's default 1 MiB limit.
  bodyLimit: 50 * 1024 * 1024,
});

await app.register(cors, { origin: true });

app.addHook("onRequest", async (request, reply) => {
  if (!request.headers["x-request-id"]) {
    request.headers["x-request-id"] = getRequestId(request.headers);
  }
  reply.header("x-request-id", request.headers["x-request-id"] as string);
});

app.get("/health", async (request, reply) => {
  const requestId = getRequestId(request.headers);
  return reply.send({
    data: {
      status: "ok",
      service: "api-gateway",
      upstream: {
        identity: identityUrl,
        customer: customerUrl,
        sku: skuUrl,
        catalog_intelligence: catalogIntelligenceUrl,
        order: orderUrl,
        billing: billingUrl,
      },
    },
    meta: { request_id: requestId, timestamp: new Date().toISOString() },
  });
});

app.get("/v1/openapi.json", async (_request, reply) => {
  return reply.send({
    openapi: "3.1.0",
    info: { title: "ConveyX API", version: "1.0.0" },
    description: "Aggregated spec stub — see docs/API.md for full outline",
    paths: {
      "/v1/entities": { get: { summary: "List entities" }, post: { summary: "Create entity" } },
      "/v1/users/me": { get: { summary: "Current user" } },
      "/v1/teams": { get: { summary: "List teams" }, post: { summary: "Create team" } },
      "/v1/products": { get: { summary: "List products" }, post: { summary: "Create product" } },
      "/v1/providers": { get: { summary: "List providers" }, post: { summary: "Create provider" } },
      "/v1/packages": { get: { summary: "List packages" }, post: { summary: "Create package" } },
      "/v1/councils": { get: { summary: "List councils" } },
      "/v1/required-data": { get: { summary: "List required data fields" } },
      "/v1/intelligence/resolve": { post: { summary: "Resolve property identifier" } },
      "/v1/intelligence/recommend": { post: { summary: "Recommend products and packages" } },
      "/v1/orders": { get: { summary: "List orders" }, post: { summary: "Create order" } },
      "/v1/invoices/generate": { post: { summary: "Generate invoice" } },
    },
  });
});

await app.register(proxy, {
  upstream: identityUrl,
  prefix: "/v1/users",
  rewritePrefix: "/v1/users",
});

await app.register(proxy, {
  upstream: identityUrl,
  prefix: "/v1/teams",
  rewritePrefix: "/v1/teams",
});

await app.register(proxy, {
  upstream: identityUrl,
  prefix: "/v1/auth",
  rewritePrefix: "/v1/auth",
});

await app.register(proxy, {
  upstream: customerUrl,
  prefix: "/v1/entities",
  rewritePrefix: "/v1/entities",
});

await app.register(proxy, {
  upstream: skuUrl,
  prefix: "/v1/products",
  rewritePrefix: "/v1/products",
});

await app.register(proxy, {
  upstream: skuUrl,
  prefix: "/v1/providers",
  rewritePrefix: "/v1/providers",
});

await app.register(proxy, {
  upstream: skuUrl,
  prefix: "/v1/required-data",
  rewritePrefix: "/v1/required-data",
});

await app.register(proxy, {
  upstream: skuUrl,
  prefix: "/v1/packages",
  rewritePrefix: "/v1/packages",
});

await app.register(proxy, {
  upstream: skuUrl,
  prefix: "/v1/councils",
  rewritePrefix: "/v1/councils",
});

await app.register(proxy, {
  upstream: catalogIntelligenceUrl,
  prefix: "/v1/intelligence",
  rewritePrefix: "/v1/intelligence",
});

await app.register(proxy, {
  upstream: orderUrl,
  prefix: "/v1/orders",
  rewritePrefix: "/v1/orders",
});

await app.register(proxy, {
  upstream: billingUrl,
  prefix: "/v1/transactions",
  rewritePrefix: "/v1/transactions",
});

await app.register(proxy, {
  upstream: billingUrl,
  prefix: "/v1/invoices",
  rewritePrefix: "/v1/invoices",
});

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`api-gateway listening on :${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
