import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { FieldType } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/custom-fields/[id]/impact
 *
 * Returns the number of stored values that would be permanently deleted
 * if the proposed changes to this field were saved. Used to power the
 * confirmation dialog before a destructive edit.
 *
 * Query params:
 *   newType    — proposed new type ("text" | "picklist"), if changing
 *   options    — comma-separated final options list (for text→picklist check)
 *   removed    — comma-separated option values being removed
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can manage custom fields.", 403);

  const existing = await db.customField.findUnique({ where: { id } });
  if (!existing) return fail("Custom field not found.", 404);

  const { searchParams } = new URL(req.url);
  const newType = searchParams.get("newType") as FieldType | null;
  const newOptions = searchParams.get("options")
    ? searchParams.get("options")!.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const removedOptions = searchParams.get("removed")
    ? searchParams.get("removed")!.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const isTask = existing.entity === "task";
  let valuesCleared = 0;

  // text → picklist: any stored value not in the new options list will be deleted
  if (newType === "picklist" && existing.type === "text") {
    if (isTask) {
      valuesCleared += await db.taskCustomFieldValue.count({
        where: { fieldId: id, ...(newOptions.length ? { value: { notIn: newOptions } } : {}) },
      });
    } else {
      valuesCleared += await db.userCustomFieldValue.count({
        where: { fieldId: id, ...(newOptions.length ? { value: { notIn: newOptions } } : {}) },
      });
    }
  }

  // Removed picklist options: values matching removed options will be deleted
  if (removedOptions.length > 0) {
    if (isTask) {
      valuesCleared += await db.taskCustomFieldValue.count({
        where: { fieldId: id, value: { in: removedOptions } },
      });
    } else {
      valuesCleared += await db.userCustomFieldValue.count({
        where: { fieldId: id, value: { in: removedOptions } },
      });
    }
  }

  return ok("Impact computed.", { valuesCleared });
}
