import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";

/**
 * PUT /api/admin/task-list-columns
 *
 * Replaces the entire column order configuration. Admin only.
 *
 * Body:
 *   columns: { columnKey: string; order: number; visible: boolean }[]
 */
export async function PUT(req: NextRequest) {
  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can configure column order.", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Request body must be valid JSON.");
  }

  const { columns } = (body ?? {}) as {
    columns: { columnKey: string; order: number; visible: boolean }[];
  };

  if (!Array.isArray(columns) || columns.length === 0) {
    return fail("columns must be a non-empty array.", 422);
  }

  // Replace all in a single transaction
  await db.$transaction([
    db.taskListColumnOrder.deleteMany(),
    db.taskListColumnOrder.createMany({
      data: columns.map((c) => ({
        columnKey: c.columnKey,
        order: c.order,
        visible: c.visible ?? true,
      })),
    }),
  ]);

  const saved = await db.taskListColumnOrder.findMany({
    orderBy: { order: "asc" },
  });

  return ok("Column order saved.", { columns: saved });
}
