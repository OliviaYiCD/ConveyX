import Fastify from "fastify";
import cors from "@fastify/cors";
import { checkDbHealth } from "./lib/db.js";
import { fail, getRequestId, ok, getEnv } from "./lib/response.js";
import { registerEntityRoutes } from "./routes/entities.js";

const port = Number(process.env.CUSTOMER_PORT ?? process.env.PORT ?? 3002);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async (request, reply) => {
  const requestId = getRequestId(request.headers);
  return reply.send(ok({ status: "ok", service: "customer-service" }, requestId));
});

app.get("/health/ready", async (request, reply) => {
  const requestId = getRequestId(request.headers);
  const dbOk = await checkDbHealth();
  if (!dbOk) {
    const err = fail("NOT_READY", "Database unavailable", requestId, 503);
    return reply.status(err.statusCode).send(err.body);
  }
  return reply.send(ok({ status: "ready", service: "customer-service" }, requestId));
});

await registerEntityRoutes(app);

try {
  getEnv("SUPABASE_URL");
  getEnv("SUPABASE_SERVICE_ROLE_KEY");
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`customer-service listening on :${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
