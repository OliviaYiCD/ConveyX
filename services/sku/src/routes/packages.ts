import type { FastifyInstance } from "fastify";
import type { CreatePackageInput, Package, PackageDetail, ProductStatus } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";

export async function registerPackageRoutes(app: FastifyInstance) {
  app.get("/v1/packages", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const q = request.query as {
      scope_type?: string;
      scope_state?: string;
      scope_council?: string;
      display_on_ui?: string;
      status?: string;
    };

    const displayOnUi =
      q.display_on_ui === undefined ? null : q.display_on_ui === "true" || q.display_on_ui === "1";

    try {
      const rows = await rpc<Package[]>("cx_list_packages", {
        p_scope_type: q.scope_type ?? null,
        p_scope_state: q.scope_state ?? null,
        p_scope_council: q.scope_council ?? null,
        p_display_on_ui: q.display_on_ui === undefined ? null : displayOnUi,
        p_status: q.status ?? null,
      });
      return reply.send(ok(rows ?? [], requestId, { total: rows?.length ?? 0 }));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.get("/v1/packages/:packageId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { packageId } = request.params as { packageId: string };

    try {
      const data = await rpc<PackageDetail | null>("cx_get_package", { p_id: packageId });
      if (!data) {
        const err = fail("NOT_FOUND", "Package not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/packages", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const body = request.body as CreatePackageInput;

    if (!body.package_name || !body.scope_type) {
      const err = fail("VALIDATION_ERROR", "package_name and scope_type are required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const pkg = await rpc<Package>("cx_create_package", {
        p_data: {
          package_name: body.package_name,
          description: body.description ?? null,
          scope_type: body.scope_type,
          scope_state: body.scope_state ?? null,
          scope_council: body.scope_council ?? null,
          display_on_ui: body.display_on_ui ?? true,
          status: body.status ?? "draft",
        },
      });

      if (body.items && body.items.length > 0) {
        const detail = await rpc<PackageDetail>("cx_set_package_items", {
          p_package_id: pkg.id,
          p_items: body.items,
        });
        return reply.status(201).send(ok(detail, requestId));
      }

      return reply.status(201).send(ok({ package: pkg, items: [] }, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.patch("/v1/packages/:packageId", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { packageId } = request.params as { packageId: string };
    const body = request.body as Partial<CreatePackageInput>;

    try {
      const data = await rpc<Package | null>("cx_update_package", {
        p_id: packageId,
        p_data: body,
      });
      if (!data) {
        const err = fail("NOT_FOUND", "Package not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.put("/v1/packages/:packageId/items", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { packageId } = request.params as { packageId: string };
    const { items } = request.body as {
      items?: { product_id: string; sort_order?: number; is_optional?: boolean }[];
    };

    if (!items || !Array.isArray(items)) {
      const err = fail("VALIDATION_ERROR", "items array is required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const data = await rpc<PackageDetail | null>("cx_set_package_items", {
        p_package_id: packageId,
        p_items: items,
      });
      if (!data) {
        const err = fail("NOT_FOUND", "Package not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });

  app.post("/v1/packages/:packageId/status", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { packageId } = request.params as { packageId: string };
    const { status } = request.body as { status?: ProductStatus };

    if (!status) {
      const err = fail("VALIDATION_ERROR", "status is required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    try {
      const data = await rpc<Package | null>("cx_set_package_status", {
        p_id: packageId,
        p_status: status,
      });
      if (!data) {
        const err = fail("NOT_FOUND", "Package not found", requestId, 404);
        return reply.status(err.statusCode).send(err.body);
      }
      return reply.send(ok(data, requestId));
    } catch (e) {
      const err = fail("DB_ERROR", e instanceof Error ? e.message : "Database error", requestId, 500);
      return reply.status(err.statusCode).send(err.body);
    }
  });
}
