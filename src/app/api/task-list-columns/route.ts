import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

/**
 * GET /api/task-list-columns
 *
 * Returns the saved column order for the task list view.
 * Accessible to ALL authenticated users so the ListView renders
 * the correct layout for members as well as admins.
 */
export async function GET(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);

  const columns = await db.taskListColumnOrder.findMany({
    orderBy: { order: "asc" },
  });

  return ok("Column order retrieved.", { columns });
}
