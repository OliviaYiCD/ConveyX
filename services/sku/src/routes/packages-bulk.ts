import type { FastifyInstance } from "fastify";
import type { FastifyInstance } from "fastify";
import type { BulkImportResult, CreatePackageInput, Package, PackageDetail } from "@conveyx/shared-types";
import { rpc } from "@conveyx/db";
import { fail, getRequestId, ok } from "../lib/response.js";

export async function registerPackageBulkRoutes(app: FastifyInstance) {
  app.post("/v1/packages/bulk", async (request, reply) => {
    const requestId = getRequestId(request.headers);
    const { packages } = request.body as { packages?: CreatePackageInput[] };

    if (!packages?.length) {
      const err = fail("VALIDATION_ERROR", "packages array is required", requestId, 400);
      return reply.status(err.statusCode).send(err.body);
    }

    const result: BulkImportResult<PackageDetail> = { created: [], errors: [], total: packages.length };

    for (let i = 0; i < packages.length; i++) {
      const body = packages[i];
      if (!body.package_name || !body.scope_type) {
        result.errors.push({
          row: i + 2,
          key: body.package_name,
          message: "package_name and scope_type are required",
        });
        continue;
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

        let detail: PackageDetail;
        if (body.items && body.items.length > 0) {
          detail = await rpc<PackageDetail>("cx_set_package_items", {
            p_package_id: pkg.id,
            p_items: body.items,
          });
        } else {
          detail = (await rpc<PackageDetail | null>("cx_get_package", { p_id: pkg.id })) ?? {
            package: pkg,
            items: [],
          };
        }
        result.created.push(detail);
      } catch (e) {
        result.errors.push({
          row: i + 2,
          key: body.package_name,
          message: e instanceof Error ? e.message : "Database error",
        });
      }
    }

    return reply.status(result.created.length > 0 ? 201 : 422).send(ok(result, requestId));
  });
}
