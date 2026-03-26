import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail } from "@/lib/response";
import { getRequestUser } from "@/lib/session";
import { serializeSubtask } from "@/app/api/tasks/route";
import { syncParentStatus } from "@/app/api/tasks/[id]/route";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/tasks/[id]/subtasks/bulk-complete
 *
 * Marks every incomplete subtask of the given parent task as "completed"
 * in a single transaction, then syncs the parent's status.
 *
 * Admin-only.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: parentId } = await ctx.params;

  const caller = getRequestUser(req);
  if (!caller) return fail("Authentication required.", 401);
  if (caller.role !== "admin") return fail("Only admins can bulk-complete subtasks.", 403);

  const parent = await db.task.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true },
  });
  if (!parent) return fail("Task not found.", 404);
  if (parent.parentId !== null) return fail("This task is itself a subtask.", 422);

  // Mark all non-completed subtasks as completed atomically
  await db.task.updateMany({
    where: { parentId, status: { not: "completed" } },
    data: { status: "completed" },
  });

  // Sync parent status (all done → "in_review")
  await syncParentStatus(parentId);

  // Return updated subtask list
  const subtasks = await db.task.findMany({
    where: { parentId },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      assignees: {
        select: {
          user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        },
        orderBy: { assignedAt: "asc" as const },
      },
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return ok("All subtasks marked as complete.", { subtasks: subtasks.map(serializeSubtask) });
}
