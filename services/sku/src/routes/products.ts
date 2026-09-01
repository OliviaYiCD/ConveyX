import type { FastifyInstance } from "fastify";
import type {
  CreateProductInput,
  Product,
  ProductListResult,
  ProductStatus,
} from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";
import { createProduct, validateProductInput } from "../lib/products.js";

export async function registerProductRoutes(app: FastifyInstance) {
  app.get("/v1/products", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const q = request.query as {
      state?: string;
      type?: string;
      council?: string;
      display_on_ui?: string;
      status?: string;
      search?: string;
      page?: string;
      page_size?: string;
    };

    const displayOnUi =
      q.display_on_ui === undefined ? null : q.display_on_ui === "true" || q.display_on_ui === "1";

    const paginated = q.page !== undefined || q.page_size !== undefined;
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = paginated
      ? Math.min(200, Math.max(1, Number(q.page_size) || 50))
      : 10000;
    const offset = (page - 1) * pageSize;

    try {
      const result = await rpc<ProductListResult>("cx_list_products", {
        p_state: q.state?.trim() || null,
        p_type: q.type?.trim() || null,
        p_council: q.council?.trim() || null,
        p_display_on_ui: q.display_on_ui === undefined ? null : displayOnUi,
        p_status: q.status?.trim() || null,
        p_search: q.search?.trim() || null,
        p_limit: pageSize,
        p_offset: offset,
      });
      const items = result?.items ?? [];
      const total = result?.total ?? items.length;
      return reply.send(ok(items, requestId, { total, page, page_size: pageSize }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/products/by-sku/:sku", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { sku } = request.params as { sku: string };

    try {
      const data = await rpc<Product | null>("cx_get_product_by_sku", { p_sku: sku });
      if (!data) {
        const err = fail("NOT_FOUND", "Product not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/products/:productId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { productId } = request.params as { productId: string };

    try {
      const data = await rpc<Product | null>("cx_get_product", { p_id: productId });
      if (!data) {
        const err = fail("NOT_FOUND", "Product not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/products", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as CreateProductInput;

    if (!body.product_name || !body.sku || !body.state || !body.type || !body.provider_id) {
      const err = fail(
        "VALIDATION_ERROR",
        "product_name, sku, state, type, and provider_id are required",
        requestId,
        400
      );
      return reply.status(err.statusCode).send(err.body);
    }
    const validationError = validateProductInput(body);
    if (validationError) {
      const err = fail("VALIDATION_ERROR", validationError, requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const product = await createProduct(body);
      return reply.status(201).send(ok(product, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.patch("/v1/products/:productId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { productId } = request.params as { productId: string };
    const body = request.body as Partial<CreateProductInput> & { status?: ProductStatus };

    try {
      const data = await rpc<Product | null>("cx_update_product", {
        p_id: productId,
        p_data: body,
      });
      if (!data) {
        const err = fail("NOT_FOUND", "Product not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/products/:productId/status", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { productId } = request.params as { productId: string };
    const { status } = request.body as { status?: ProductStatus };

    if (!status) {
      const err = fail("VALIDATION_ERROR", "status is required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const data = await rpc<Product | null>("cx_set_product_status", {
        p_id: productId,
        p_status: status,
      });
      if (!data) {
        const err = fail("NOT_FOUND", "Product not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.delete("/v1/products/:productId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { productId } = request.params as { productId: string };

    try {
      const data = await rpc<Product | null>("cx_delete_product", { p_id: productId });
      if (!data) {
        const err = fail("NOT_FOUND", "Product not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
