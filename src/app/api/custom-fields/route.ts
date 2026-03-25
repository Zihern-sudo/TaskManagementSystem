import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

/**
 * GET /api/custom-fields
 *
 * Returns all defined custom fields ordered by display order.
 * Accessible to ALL authenticated users (not just admins) so the
 * CustomFieldsContext can hydrate for members as well.
 */
export async function GET(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const fields = await db.customField.findMany({
    orderBy: { order: "asc" },
  });

  return ok("Custom fields retrieved successfully.", { fields });
}
