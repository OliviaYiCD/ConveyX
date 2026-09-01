import Fastify from "fastify";
import cors from "@fastify/cors";
import { fail, getEnv, getRequestId, ok } from "./lib/response.js";
import { SkuClient } from "./lib/sku-client.js";
import { registerIntelligenceRoutes } from "./routes/intelligence.js";

function serviceUrl(value: string | undefined, fallback: string): string {
  const raw = (value ?? fallback).trim();
  if (!raw) return fallback;

  let host: string;
  let scheme = "https";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      host = parsed.host;
      scheme = parsed.protocol.replace(":", "");
    } catch {
      return fallback;
    }
  } else {
    host = raw.replace(/\/$/, "");
  }

  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return `http://${host}`;

  const hostname = host.split(":")[0] ?? host;
  if (!hostname.includes(".")) {
    host = `${hostname}.onrender.com`;
    scheme = "https";
  }

  return `${scheme}://${host}`;
}

const port = Number(process.env.CATALOG_INTELLIGENCE_PORT ?? process.env.PORT ?? 3004);
const skuUrl = serviceUrl(process.env.SKU_SERVICE_URL, "http://localhost:3003");

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
