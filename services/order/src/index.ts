import Fastify from "fastify";
import cors from "@fastify/cors";
import { checkDbHealth } from "@conveyx/db";
import { fail, getRequestId, ok, getEnv } from "./lib/response.js";
import { registerOrderRoutes } from "./routes/orders.js";

const port = Number(process.env.ORDER_PORT ?? process.env.PORT ?? 3007);
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async (request, reply) => {
  const requestId = getRequestId(request.headers);
  return reply.send(ok({ status: "ok", service: "order-service" }, requestId));
});

app.get("/health/ready", async (request, reply) => {
  const requestId = getRequestId(request.headers);
  const dbOk = await checkDbHealth();
  if (!dbOk) {
    const err = fail("NOT_READY", "Database unavailable", requestId, 503);
    return reply.status(err.statusCode).send(err.body);
  }
  return reply.send(ok({ status: "ready", service: "order-service" }, requestId));
});

await registerOrderRoutes(app);

try {
  getEnv("SUPABASE_URL");
  getEnv("SUPABASE_SERVICE_ROLE_KEY");
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`order-service listening on :${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
