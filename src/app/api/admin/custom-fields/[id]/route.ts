import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

// ── PATCH /api/admin/custom-fields/[id] ────────────────────────────────────

/**
 * Updates a custom field definition. Admin only.
 * Mutable fields: label, options (picklist only), required, order, showInListView.
 * Immutable after creation: fieldKey, type, entity.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can manage custom fields.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const data = (body ?? {}) as Record<string, unknown>;

  if (Object.keys(data).length === 0) {
    return fail("Provide at least one field to update.");
  }

  const existing = await db.customField.findUnique({ where: { id } });
  if (!existing) return fail("Custom field not found.", 404);

  const errors: Record<string, string[]> = {};

  if ("label" in data && (typeof data.label !== "string" || !(data.label as string).trim())) {
    errors.label = ["Label must be a non-empty string."];
  }

  if ("options" in data && existing.type === "picklist") {
    if (!Array.isArray(data.options) || (data.options as unknown[]).length === 0) {
      errors.options = ["Picklist fields require at least one option."];
    } else if ((data.options as unknown[]).some((o) => typeof o !== "string" || !(o as string).trim())) {
      errors.options = ["All options must be non-empty strings."];
    }
  }

  if ("order" in data && typeof data.order !== "number") {
    errors.order = ["Order must be a number."];
  }

  if (Object.keys(errors).length > 0) {
    return fail("Validation failed.", 422, errors);
  }

  const updateData: Record<string, unknown> = {};
  if ("label" in data) updateData.label = (data.label as string).trim();
  if ("options" in data && existing.type === "picklist") {
    updateData.options = (data.options as string[]).map((o) => (o as string).trim());
  }
  if ("required" in data) updateData.required = data.required === true;
  if ("showInListView" in data) updateData.showInListView = data.showInListView === true;
  if ("order" in data) updateData.order = data.order as number;

  const field = await db.customField.update({ where: { id }, data: updateData });

  return ok("Custom field updated successfully.", { field });
}

// ── DELETE /api/admin/custom-fields/[id] ───────────────────────────────────

/**
 * Deletes a custom field and all its task values (cascade). Admin only.
 */
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can manage custom fields.", 403);

  const existing = await db.customField.findUnique({ where: { id } });
  if (!existing) return fail("Custom field not found.", 404);

  await db.customField.delete({ where: { id } });

  return ok("Custom field and all its values deleted successfully.");
}
