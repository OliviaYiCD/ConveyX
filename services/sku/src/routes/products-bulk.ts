import type { FastifyInstance } from "fastify";
import type { BulkImportResult, CreateProductInput, Product } from "@conveyx/shared-types";
import { fail, getRequestId, ok } from "../lib/response.js";
import { createProduct, validateProductInput } from "../lib/products.js";

export async function registerProductBulkRoutes(app: FastifyInstance) {
  app.post("/v1/products/bulk", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { products } = request.body as { products?: CreateProductInput[] };

    if (!products || !Array.isArray(products) || products.length === 0) {
      const err = fail("VALIDATION_ERROR", "products array is required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    const result: BulkImportResult<Product> = {
      created: [],
      errors: [],
      total: products.length,
    };

    for (let i = 0; i < products.length; i++) {
      const body = products[i];
      const validationError = validateProductInput(body);
      if (validationError) {
        result.errors.push({ row: i + 2, key: body.sku, message: validationError });
        continue;
      }
      try {
        const product = await createProduct(body);
        result.created.push(product);
      } catch (e) {
        result.errors.push({
          row: i + 2,
          key: body.sku,
          message: e instanceof Error ? e.message : "Database error",
        });
      }
    }

    const statusCode = result.created.length > 0 ? 201 : 422;
    return reply.status(statusCode).send(ok(result, requestId));
  });
}
