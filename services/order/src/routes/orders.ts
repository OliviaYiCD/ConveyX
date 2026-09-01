import type { FastifyInstance } from "fastify";
import type { CreateOrderInput, Order, OrderDetail } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";
import { buildLineFromProduct, fetchProduct } from "../lib/pricing.js";

export async function registerOrderRoutes(app: FastifyInstance) {
  app.get("/v1/orders", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const q = request.query as {
      entity_id?: string;
      status?: string;
      q?: string;
      product?: string;
      customer?: string;
    };

    try {
      const rows = await rpc<Order[]>("cx_list_orders", {
        p_entity_id: q.entity_id ?? null,
        p_status: q.status ?? null,
        p_q: q.q?.trim() || null,
        p_product: q.product?.trim() || null,
        p_customer: q.customer?.trim() || null,
      });
      return reply.send(ok(rows ?? [], requestId, { total: rows?.length ?? 0 }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/orders/:orderId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { orderId } = request.params as { orderId: string };

    try {
      const data = await rpc<OrderDetail | null>("cx_get_order", { p_id: orderId });
      if (!data) {
        const err = fail("NOT_FOUND", "Order not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/orders", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as CreateOrderInput;

    if (!body.entity_id || !body.property_address || !body.lines?.length) {
      const err = fail("VALIDATION_ERROR", "entity_id, property_address, and lines are required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const lines = [];
      for (let i = 0; i < body.lines.length; i++) {
        const line = body.lines[i];
        const product = await fetchProduct(line.product_id);
        if (!product) {
          const err = fail("NOT_FOUND", `Product not found: ${line.product_id}`, requestId, 404);
          return reply.status(err.statusCode).send(err.body);
        }
        lines.push(
          await buildLineFromProduct(
            product,
            line.quantity ?? 1,
            line.required_data_buyer ?? {},
            line.required_data_seller ?? {},
            i
          )
        );
      }

      const order = await rpc<OrderDetail>("cx_create_order", {
        p_data: {
          entity_id: body.entity_id,
          property_address: body.property_address,
          property_context: body.property_context,
          include_body_corp: body.include_body_corp ?? false,
          status: "draft",
          lines,
        },
      });
      return reply.status(201).send(ok(order, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/orders/:orderId/submit", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { orderId } = request.params as { orderId: string };

    try {
      const data = await rpc<OrderDetail | null>("cx_submit_order", { p_id: orderId });
      if (!data) {
        const err = fail("NOT_FOUND", "Order not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submit failed";
      const err = fail("SUBMIT_ERROR", msg, requestId, 422);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
