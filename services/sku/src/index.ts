import Fastify from "fastify";
import cors from "@fastify/cors";
import { checkDbHealth } from "./lib/db.js";
import { fail, getRequestId, ok, getEnv } from "./lib/response.js";
import { registerProviderRoutes } from "./routes/providers.js";
import { registerRequiredDataRoutes } from "./routes/required-data.js";
import { registerCouncilRoutes } from "./routes/councils.js";
import { registerProductRoutes } from "./routes/products.js";
import { registerProductBulkRoutes } from "./routes/products-bulk.js";
import { registerPackageRoutes } from "./routes/packages.js";
import { registerPackageBulkRoutes } from "./routes/packages-bulk.js";
import { registerProviderBulkRoutes } from "./routes/providers-bulk.js";
import { registerRequiredDataBulkRoutes } from "./routes/required-data-bulk.js";

const port = Number(process.env.SKU_PORT ?? process.env.PORT ?? 3003);

const app = Fastify({
  logger: true,
  // Bulk CSV imports (thousands of products) exceed Fastify's default 1 MiB limit.
  bodyLimit: 50 * 1024 * 1024,
});

await app.register(cors, { origin: true });

app.get("/health", async (request, reply) => {
  const requestId = getRequestId(request.headers);
  return reply.send(ok({ status: "ok", service: "sku-service" }, requestId));
});

app.get("/health/ready", async (request, reply) => {
  const requestId = getRequestId(request.headers);
  const dbOk = await checkDbHealth();
  if (!dbOk) {
    const err = fail("NOT_READY", "Database unavailable", requestId, 503);
    return reply.status(err.statusCode).send(err.body);
  }
  return reply.send(ok({ status: "ready", service: "sku-service" }, requestId));
});

await registerProviderRoutes(app);
await registerProviderBulkRoutes(app);
await registerRequiredDataRoutes(app);
await registerRequiredDataBulkRoutes(app);
await registerCouncilRoutes(app);
await registerProductBulkRoutes(app);
await registerProductRoutes(app);
await registerPackageBulkRoutes(app);
await registerPackageRoutes(app);

try {
  getEnv("SUPABASE_URL");
  getEnv("SUPABASE_SERVICE_ROLE_KEY");
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`sku-service listening on :${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
